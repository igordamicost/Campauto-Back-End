import { ReservationRepository } from "../repositories/reservation.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { db } from "../config/database.js";

/**
 * Serviço de scheduler para verificar e atualizar status de reservas
 */
export class ReservationSchedulerService {
  /**
   * Horas antes do vencimento para considerar como "DUE_SOON" (configurável via env)
   */
  static getDueSoonHours() {
    return Number(process.env.RESERVATION_DUE_SOON_HOURS || 24);
  }

  /**
   * Executa verificação de reservas e atualiza status
   */
  static async checkReservations() {
    try {
      console.log("[Scheduler] Iniciando verificação de reservas...");

      const dueSoonHours = this.getDueSoonHours();
      const reservations = await ReservationRepository.getReservationsForStatusUpdate(
        dueSoonHours
      );

      let updated = 0;
      let notificationsSent = 0;

      for (const reservation of reservations) {
        const now = new Date();
        const dueAt = new Date(reservation.due_at);
        const hoursUntilDue = (dueAt - now) / (1000 * 60 * 60);

        let newStatus = reservation.status;
        let notificationType = null;

        // Reserva vencida
        if (dueAt <= now) {
          if (reservation.status !== "OVERDUE") {
            newStatus = "OVERDUE";
            notificationType = "RESERVATION_OVERDUE";
          }
        }
        // Reserva vencendo em breve
        else if (hoursUntilDue <= dueSoonHours && reservation.status === "ACTIVE") {
          newStatus = "DUE_SOON";
          notificationType = "RESERVATION_DUE_SOON";
        }

        // Atualizar status se necessário
        if (newStatus !== reservation.status) {
          await ReservationRepository.update(reservation.id, { status: newStatus });

          // Registrar evento
          await db.query(
            `INSERT INTO reservation_events 
             (reservation_id, event_type, old_status, new_status)
             VALUES (?, 'STATUS_CHANGED', ?, ?)`,
            [reservation.id, reservation.status, newStatus]
          );

          updated++;
        }

        // Enviar notificações
        if (notificationType) {
          await this.sendNotifications(reservation, notificationType);
          notificationsSent++;
        }
      }

      console.log(
        `[Scheduler] Verificação concluída: ${updated} reservas atualizadas, ${notificationsSent} notificações enviadas`
      );

      return { updated, notificationsSent };
    } catch (error) {
      console.error("[Scheduler] Erro ao verificar reservas:", error);
      throw error;
    }
  }

  /**
   * Envia notificações para vendedor e gerentes
   */
  static async sendNotifications(reservation, notificationType) {
    try {
      const reservationData = await ReservationRepository.getById(reservation.id);
      if (!reservationData) return;

      const dueAt = new Date(reservation.due_at);
      const isOverdue = dueAt <= new Date();

      // Notificar vendedor
      const wasSentToSalesperson = await NotificationRepository.wasNotificationSentToday(
        reservation.id,
        reservation.salesperson_user_id,
        notificationType
      );

      if (!wasSentToSalesperson) {
        const title = isOverdue
          ? "Reserva Vencida"
          : "Reserva Vencendo em Breve";
        const message = isOverdue
          ? `A reserva #${reservation.id} do produto "${reservationData.product_name}" está vencida desde ${dueAt.toLocaleString("pt-BR")}.`
          : `A reserva #${reservation.id} do produto "${reservationData.product_name}" vence em ${dueAt.toLocaleString("pt-BR")}.`;

        await NotificationRepository.create({
          user_id: reservation.salesperson_user_id,
          type: notificationType,
          title,
          message,
          metadata: JSON.stringify({
            reservation_id: reservation.id,
            product_id: reservation.product_id,
            due_at: reservation.due_at,
          }),
        });

        await NotificationRepository.logNotificationSent(
          reservation.id,
          reservation.salesperson_user_id,
          notificationType
        );
      }

      // Notificar gerentes (ADMIN/MASTER)
      const managers = await NotificationRepository.getManagers();

      for (const manager of managers) {
        // Não notificar o próprio vendedor se ele for gerente
        if (manager.id === reservation.salesperson_user_id) continue;

        const wasSentToManager = await NotificationRepository.wasNotificationSentToday(
          reservation.id,
          manager.id,
          `${notificationType}_MANAGER`
        );

        if (!wasSentToManager) {
          const title = isOverdue
            ? "Reserva Vencida - Ação Necessária"
            : "Reserva Vencendo em Breve";
          const message = isOverdue
            ? `A reserva #${reservation.id} do vendedor "${reservationData.salesperson_name}" está vencida desde ${dueAt.toLocaleString("pt-BR")}.`
            : `A reserva #${reservation.id} do vendedor "${reservationData.salesperson_name}" vence em ${dueAt.toLocaleString("pt-BR")}.`;

          await NotificationRepository.create({
            user_id: manager.id,
            type: `${notificationType}_MANAGER`,
            title,
            message,
            metadata: JSON.stringify({
              reservation_id: reservation.id,
              salesperson_id: reservation.salesperson_user_id,
              product_id: reservation.product_id,
              due_at: reservation.due_at,
            }),
          });

          await NotificationRepository.logNotificationSent(
            reservation.id,
            manager.id,
            `${notificationType}_MANAGER`
          );
        }
      }
    } catch (error) {
      console.error(
        `[Scheduler] Erro ao enviar notificações para reserva ${reservation.id}:`,
        error
      );
    }
  }

  /**
   * Inicia o scheduler (executa a cada hora)
   */
  static start() {
    // Executar imediatamente na inicialização
    this.checkReservations().catch((err) => {
      console.error("[Scheduler] Erro na execução inicial:", err);
    });

    // Executar a cada hora (3600000 ms)
    const intervalMs = 60 * 60 * 1000; // 1 hora

    setInterval(() => {
      this.checkReservations().catch((err) => {
        console.error("[Scheduler] Erro na execução agendada:", err);
      });
    }, intervalMs);

    console.log(`[Scheduler] Scheduler iniciado. Verificações a cada ${intervalMs / 1000 / 60} minutos.`);
  }
}
