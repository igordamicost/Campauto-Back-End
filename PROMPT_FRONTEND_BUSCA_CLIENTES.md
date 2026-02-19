# 🎯 Busca Inteligente de Clientes - Guia para Frontend

## 📋 Visão Geral

A API de busca de clientes foi aprimorada com uma **busca inteligente** que entende variações de texto, preposições e sinônimos. Isso permite que o usuário encontre clientes mesmo quando não sabe exatamente como o nome está cadastrado.

---

## 🔍 Endpoint de Busca

### GET `/clientes`

**URL Base:** `https://api.xn--jrcarpeas-w3a.com.br/clientes`

**Autenticação:** Requer token JWT no header `Authorization: Bearer {token}`

---

## 📝 Parâmetros de Query

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `q` | string | **Texto de busca inteligente** (nome, telefone, email, município) | `"bonito"`, `"municipio de bonito"` |
| `page` | number | Número da página (padrão: 1) | `1` |
| `limit` | number | Itens por página (padrão: 10, máximo: 1000) | `20` |
| `sortBy` | string | Campo para ordenação (padrão: `fantasia`) | `"fantasia"`, `"razao_social"`, `"municipio"` |
| `sortDir` | string | Direção da ordenação: `asc` ou `desc` (padrão: `asc`) | `"asc"`, `"desc"` |

---

## ✨ Funcionalidades da Busca Inteligente

### 1. **Normalização de Texto**
A busca remove automaticamente preposições e normaliza o texto:
- ✅ Remove: "de", "da", "do", "das", "dos", "e", "em", "no", "na", etc.
- ✅ Normaliza espaços múltiplos
- ✅ Busca case-insensitive (ignora maiúsculas/minúsculas)

**Exemplos:**
```
"Municipio de Bonito" → encontra "Bonito"
"Prefeitura da Bonito" → encontra "Bonito"
"Municipio Bonito" → encontra "Bonito"
```

### 2. **Tratamento de Sinônimos**
A busca trata sinônimos automaticamente:
- ✅ "município" e "prefeitura" são tratados como equivalentes
- ✅ "Municipio de Bonito" encontra clientes do município "Bonito"
- ✅ "Prefeitura de Bonito" também encontra clientes do município "Bonito"

### 3. **Busca Multi-Campo**
A busca procura automaticamente em:
- 📝 **Nome:** `fantasia` e `razao_social`
- 📞 **Telefone:** `telefone` e `celular`
- 📧 **Email:** `email`
- 🏙️ **Município:** `municipio`

### 4. **Detecção Automática**
- 🔍 **Telefone:** Se o termo parece ser telefone (ex: "67912345678"), busca especificamente em telefone/celular
- 📧 **Email:** Se o termo contém "@" e ".", busca especificamente em email
- 📝 **Texto:** Caso contrário, busca normalizada em todos os campos

---

## 💡 Exemplos de Uso

### Exemplo 1: Busca Simples por Nome ou Município
```javascript
// Busca "bonito" - encontra tanto clientes com nome "bonito" 
// quanto clientes do município "Bonito"
const response = await fetch(
  'https://api.xn--jrcarpeas-w3a.com.br/clientes?q=bonito&page=1&limit=20&sortBy=fantasia&sortDir=asc',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Exemplo 2: Busca com Preposições
```javascript
// Funciona mesmo com preposições
const response = await fetch(
  'https://api.xn--jrcarpeas-w3a.com.br/clientes?q=municipio de bonito',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Exemplo 3: Busca por Sinônimo (Prefeitura)
```javascript
// "prefeitura" é tratado como sinônimo de "município"
const response = await fetch(
  'https://api.xn--jrcarpeas-w3a.com.br/clientes?q=prefeitura de bonito',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Exemplo 4: Busca por Telefone
```javascript
// Detecta automaticamente que é telefone e busca em telefone/celular
const response = await fetch(
  'https://api.xn--jrcarpeas-w3a.com.br/clientes?q=67912345678',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Exemplo 5: Busca por Email
```javascript
// Detecta automaticamente que é email
const response = await fetch(
  'https://api.xn--jrcarpeas-w3a.com.br/clientes?q=cliente@email.com',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

---

## 📦 Estrutura da Response

```json
{
  "data": [
    {
      "id": 1,
      "fantasia": "Cliente Exemplo",
      "razao_social": "Cliente Exemplo LTDA",
      "email": "cliente@email.com",
      "telefone": "67912345678",
      "celular": "67987654321",
      "municipio": "Bonito",
      "uf": "MS",
      // ... outros campos
    }
  ],
  "page": 1,
  "perPage": 20,
  "total": 15,
  "totalPages": 1
}
```

---

## 🎨 Implementação no Frontend

### Exemplo com React/Next.js

```jsx
import { useState, useEffect } from 'react';

function ClientesSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const searchClientes = async (term, pageNum = 1) => {
    if (!term.trim()) {
      setClientes([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.xn--jrcarpeas-w3a.com.br/clientes?q=${encodeURIComponent(term)}&page=${pageNum}&limit=20&sortBy=fantasia&sortDir=asc`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const data = await response.json();
      setClientes(data.data);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para evitar muitas requisições
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchClientes(searchTerm, 1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Buscar por nome, telefone, email ou município..."
        className="search-input"
      />
      
      {loading && <p>Buscando...</p>}
      
      <div className="clientes-list">
        {clientes.map(cliente => (
          <div key={cliente.id}>
            <h3>{cliente.fantasia || cliente.razao_social}</h3>
            <p>{cliente.municipio} - {cliente.uf}</p>
            <p>{cliente.email}</p>
            <p>{cliente.telefone || cliente.celular}</p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => searchClientes(searchTerm, page - 1)}
            disabled={page === 1}
          >
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button 
            onClick={() => searchClientes(searchTerm, page + 1)}
            disabled={page === totalPages}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
```

### Exemplo com Vue.js

```vue
<template>
  <div>
    <input
      v-model="searchTerm"
      @input="debouncedSearch"
      placeholder="Buscar por nome, telefone, email ou município..."
    />
    
    <div v-if="loading">Buscando...</div>
    
    <div v-for="cliente in clientes" :key="cliente.id">
      <h3>{{ cliente.fantasia || cliente.razao_social }}</h3>
      <p>{{ cliente.municipio }} - {{ cliente.uf }}</p>
      <p>{{ cliente.email }}</p>
      <p>{{ cliente.telefone || cliente.celular }}</p>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';

export default {
  setup() {
    const searchTerm = ref('');
    const clientes = ref([]);
    const loading = ref(false);
    const page = ref(1);
    const totalPages = ref(1);
    let debounceTimer = null;

    const searchClientes = async (term, pageNum = 1) => {
      if (!term.trim()) {
        clientes.value = [];
        return;
      }

      loading.value = true;
      try {
        const response = await fetch(
          `https://api.xn--jrcarpeas-w3a.com.br/clientes?q=${encodeURIComponent(term)}&page=${pageNum}&limit=20&sortBy=fantasia&sortDir=asc`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        const data = await response.json();
        clientes.value = data.data;
        totalPages.value = data.totalPages;
        page.value = data.page;
      } catch (error) {
        console.error('Erro na busca:', error);
      } finally {
        loading.value = false;
      }
    };

    const debouncedSearch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchClientes(searchTerm.value, 1);
      }, 500);
    };

    return {
      searchTerm,
      clientes,
      loading,
      page,
      totalPages,
      debouncedSearch
    };
  }
};
</script>
```

---

## 🎯 Casos de Uso Comuns

### 1. Campo de Busca Universal
Permita que o usuário digite qualquer coisa no campo de busca:
- Nome do cliente
- Município (com ou sem preposições)
- Telefone
- Email

**Exemplo de placeholder:**
```
"Buscar por nome, telefone, email ou município..."
```

### 2. Sugestões de Busca
Você pode mostrar sugestões enquanto o usuário digita:
```javascript
// Exemplo de sugestões
const suggestions = [
  "municipio de bonito",
  "prefeitura de bonito",
  "bonito"
];
```

### 3. Filtros Adicionais (Opcional)
Se necessário, você pode combinar a busca inteligente com outros filtros:
```javascript
// Busca + filtro por UF
const url = `https://api.xn--jrcarpeas-w3a.com.br/clientes?q=bonito&uf=MS`;
```

---

## ⚠️ Observações Importantes

1. **Sem Busca (`q` vazio):** Se não houver parâmetro `q`, a API retorna a lista completa com paginação padrão.

2. **Performance:** A busca é otimizada, mas recomenda-se usar debounce (esperar ~500ms após o usuário parar de digitar) para evitar muitas requisições.

3. **Encoding:** Sempre use `encodeURIComponent()` ao construir URLs com parâmetros de busca.

4. **Autenticação:** Todas as requisições requerem token JWT válido.

5. **Limite de Resultados:** O máximo de itens por página é 1000, mas recomenda-se usar valores menores (20-50) para melhor performance.

---

## 🧪 Testes

### Teste 1: Busca Simples
```
GET /clientes?q=bonito
```
**Esperado:** Encontra clientes com nome "bonito" ou do município "Bonito"

### Teste 2: Busca com Preposição
```
GET /clientes?q=municipio de bonito
```
**Esperado:** Encontra clientes do município "Bonito" (ignora "municipio de")

### Teste 3: Busca com Sinônimo
```
GET /clientes?q=prefeitura de bonito
```
**Esperado:** Encontra clientes do município "Bonito" (trata "prefeitura" como sinônimo)

### Teste 4: Busca por Telefone
```
GET /clientes?q=67912345678
```
**Esperado:** Encontra clientes com esse telefone ou celular

### Teste 5: Busca por Email
```
GET /clientes?q=cliente@email.com
```
**Esperado:** Encontra cliente com esse email

---

## 📚 Recursos Adicionais

- **Documentação Completa:** Ver `DOCUMENTACAO_SISTEMA.md`
- **Testes de API:** Ver `TESTES_API.md`
- **Swagger UI:** Acesse `https://api.xn--jrcarpeas-w3a.com.br/docs` (quando disponível)

---

## 🆘 Suporte

Se tiver dúvidas sobre a implementação ou encontrar problemas, verifique:
1. Token JWT válido
2. Encoding correto dos parâmetros
3. Headers de autenticação
4. Formato da URL

---

**Última atualização:** 19/02/2026
