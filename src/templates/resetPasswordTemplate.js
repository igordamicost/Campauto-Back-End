export function resetPasswordTemplate(link) {
  return `
    <div style="font-family:Arial;padding:30px">
      <h2>Redefinição de senha</h2>
      <p>Clique abaixo:</p>
      <a href="${link}" style="background:#0d6efd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
        Alterar senha
      </a>
    </div>
  `;
}
