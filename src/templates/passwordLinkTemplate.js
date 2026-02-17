/**
 * Template HTML para links de senha (primeiro acesso ou recuperação).
 */
export function passwordLinkTemplate(link, options = {}) {
  const { title = "Redefinição de senha", ctaText = "Alterar senha" } = options;
  return `
    <div style="font-family:Arial;padding:30px">
      <h2>${title}</h2>
      <p>Clique no botão abaixo para ${ctaText.toLowerCase()}:</p>
      <a href="${link}" style="background:#0d6efd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
        ${ctaText}
      </a>
      <p style="color:#666;margin-top:20px;font-size:12px">Este link expira em 1 hora.</p>
    </div>
  `;
}
