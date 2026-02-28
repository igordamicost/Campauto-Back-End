import { renderTemplate } from "./templateRenderService.js";

function getQuoteHtml(quote) {
    const companyLogo = quote.empresas && quote.empresas.logo_url ? `<img src="${quote.empresas.logo_url}" class="logo" />` : '';
    const companyName = quote.empresas ? quote.empresas.razao_social || quote.empresas.nome_fantasia : '';
    const companyCnpj = quote.empresas ? `CNPJ: ${quote.empresas.cnpj}` : '';

    const clientName = quote.clientes ? quote.clientes.nome : '';
    const clientDocument = quote.clientes && quote.clientes.cpf_cnpj ? `Documento: ${quote.clientes.cpf_cnpj}` : '';
    const clientEmail = quote.clientes && quote.clientes.email ? `Email: ${quote.clientes.email}` : '';

    const carDetail = quote.veiculos ? `${quote.veiculos.placa || ''} - ${quote.veiculos.modelo || ''} - ${quote.veiculos.marca || ''}` : '';

    let htmlItens = '';
    if (quote.json_itens && Array.isArray(quote.json_itens)) {
        for (const item of quote.json_itens) {
            htmlItens += `
        <tr>
          <td>${item.descricao || ''}</td>
          <td class="text-center">${item.quantidade || 0}</td>
          <td class="text-right">R$ ${Number(item.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
          <td class="text-right">R$ ${Number(item.total || 0).toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
        }
    }

    let htmlServicos = '';
    if (quote.json_itens_servico && Array.isArray(quote.json_itens_servico)) {
        for (const servico of quote.json_itens_servico) {
            htmlServicos += `
        <tr>
          <td>${servico.servico_nome || ''}</td>
          <td class="text-center">1</td>
          <td class="text-right">R$ ${Number(servico.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
          <td class="text-right">R$ ${Number(servico.valor_unitario || 0).toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
        }
    }

    const itemsTable = htmlItens ? `
    <h3 class="section-title">Peças / Produtos</h3>
    <table class="table">
      <thead>
        <tr>
          <th class="text-left">Descrição</th>
          <th class="text-center">Qtd</th>
          <th class="text-right">V. Unitário</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${htmlItens}
      </tbody>
    </table>
  ` : '';

    const servicesTable = htmlServicos ? `
    <h3 class="section-title">Serviços</h3>
    <table class="table">
      <thead>
        <tr>
          <th class="text-left">Descrição</th>
          <th class="text-center">Qtd</th>
          <th class="text-right">V. Unitário</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${htmlServicos}
      </tbody>
    </table>
  ` : '';

    const layout = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 0; }
        .container { padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
        .logo { max-height: 60px; max-width: 150px; }
        .company-info { text-align: left; flex: 1; padding-left: 20px; }
        .company-info h1 { margin: 0 0 5px 0; font-size: 18px; color: #111; }
        .company-info p { margin: 2px 0; color: #555; }
        .quote-info { text-align: right; }
        .quote-info h2 { margin: 0; font-size: 24px; color: #2c3e50; }
        .quote-info p { margin: 5px 0; font-weight: bold; }
        
        .client-section { margin-bottom: 25px; display: flex; justify-content: space-between; background: #f9f9f9; padding: 15px; border-radius: 5px; }
        .client-info p, .car-info p { margin: 4px 0; }
        .client-info h3, .car-info h3 { margin-top: 0; margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        
        .section-title { font-size: 14px; margin-top: 20px; margin-bottom: 10px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 5px;}
        
        .table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .table th, .table td { padding: 10px; border-bottom: 1px solid #eee; }
        .table th { background-color: #f8f9fa; font-weight: bold; color: #444; }
        
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        
        .totals-section { margin-top: 30px; display: flex; justify-content: flex-end; }
        .totals-table { width: 300px; border-collapse: collapse; }
        .totals-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .totals-table tr:last-child td { border-bottom: none; font-weight: bold; font-size: 14px; background: #f8f9fa;}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>${companyLogo}</div>
          <div class="company-info">
            <h1>${companyName}</h1>
            <p>${companyCnpj}</p>
          </div>
          <div class="quote-info">
            <h2>ORÇAMENTO</h2>
            <p>Nº ${quote.numero_sequencial || quote.id}</p>
            <p>Data: ${quote.data ? new Date(quote.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        
        <div class="client-section">
          <div class="client-info">
            <h3>Cliente</h3>
            <p><strong>Nome:</strong> ${clientName}</p>
            <p>${clientDocument}</p>
            <p>${clientEmail}</p>
          </div>
          <div class="car-info">
            <h3>Veículo</h3>
            <p>${carDetail || 'N/A'}</p>
            <p><strong>KM:</strong> ${quote.km || 'N/A'}</p>
          </div>
        </div>

        ${itemsTable}
        ${servicesTable}

        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td>Subtotal Peças:</td>
              <td class="text-right">R$ ${Number(quote.total_pecas || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr>
              <td>Subtotal Serviços:</td>
              <td class="text-right">R$ ${Number(quote.total_servico || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr>
              <td>Desconto:</td>
              <td class="text-right">R$ ${Number(quote.desconto || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
            <tr>
              <td>Total Geral:</td>
              <td class="text-right">R$ ${Number(quote.total || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
          </table>
        </div>
        
        ${quote.observacoes ? `
        <div style="margin-top: 30px; font-size: 11px; color: #666; background: #f9f9f9; padding: 15px; border-left: 3px solid #2c3e50;">
          <strong>Observações:</strong><br>
          ${quote.observacoes.replace(/\n/g, '<br>')}
        </div>` : ''}
      </div>
    </body>
    </html>
  `;

    return layout;
}

export { getQuoteHtml };
