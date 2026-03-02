# Prompt: Módulos, Permissões, Roles e Menu Dinâmico (Backend)

## Objetivo

1. **Tabelas**: `modules`, `permissions`, `menu_items`, `role_permissions` com estrutura necessária
2. **Vínculos**: módulos → permissões → roles (role_permissions)
3. **Menu dinâmico**: backend envia ao frontend o menu filtrado pelas permissões do usuário
4. **Hierarquia**: DEV > MASTER. DEV tem bypass total. MASTER tem todas as permissões via role_permissions
5. **Usuário id 2** (igor sotolani) = MASTER, único usuário inicial, pode cadastrar os demais

---

## 1. Arquitetura

```
modules (módulos do sistema: dashboard, vendas, clientes, etc.)
    ↓
permissions (permissões vinculadas a módulos via module_id)
    ↓
role_permissions (roles têm permissões)
    ↓
users.role_id → roles → permissões do usuário

menu_items (estrutura do menu: label, path, permission, module_key)
    ↓ filtrado por permissões do usuário
menu retornado em GET /auth/me
```

**Fluxo do menu:**
- O backend possui a tabela `menu_items` com a estrutura completa do menu
- Cada item do menu tem uma `permission` necessária para ser exibido
- Ao responder `GET /auth/me`, o backend filtra `menu_items` pelas permissões da role do usuário
- Retorna o `menu` filtrado na resposta
- O frontend exibe o menu dinamicamente (não mais hardcoded)

---

## 2. Migrations (executar em ordem)

| Ordem | Arquivo | Descrição |
|-------|---------|-----------|
| 1 | `003_rbac_system.sql` | roles, permissions, role_permissions |
| 2 | `038_modules_system.sql` | modules, module_id em permissions |
| 3 | `040_menu_items.sql` | menu_items |
| 4 | `043_dev_only_modules_menu.sql` | modules seed, module_id, DEV-only |
| 5 | `044_menu_seed.sql` | seed completo do menu |
| 6 | `045_modules_permissions_menu_completo.sql` | icon/order em modules, permissões faltantes, DEV-only |

**Comando:**
```bash
mysql -u user -p campauto < database/migrations/045_modules_permissions_menu_completo.sql
```

---

## 3. Resposta GET /auth/me

```json
{
  "user": {
    "id": 2,
    "name": "igor sotolani",
    "email": "contatodmsotolani@gmail.com",
    "role": {
      "id": 1,
      "name": "DEV",
      "description": "Desenvolvedor - Acesso total"
    }
  },
  "modules": [...],
  "permissions": ["dashboard.view", "sales.read", ...],
  "permissionsDetail": [...],
  "menu": [
    {
      "id": 1,
      "parent_id": null,
      "module_key": "dashboard",
      "label": "Mapa do Sistema",
      "path": "/dashboard",
      "icon": "LayoutDashboard",
      "order": 0,
      "permission": "dashboard.view",
      "children": []
    },
    {
      "id": 2,
      "parent_id": null,
      "module_key": "vendas",
      "label": "Vendas",
      "path": null,
      "icon": "ShoppingCart",
      "order": 1,
      "permission": "sales.read",
      "children": [...]
    }
  ]
}
```

**Lógica do menu:**
1. Se `user.role.name === 'DEV'`: retornar todos os menu_items em árvore
2. Caso contrário: filtrar menu_items onde `user.permissions` inclui `item.permission`
3. Montar árvore (parent_id → children)

---

## 4. Endpoints

| Método | Rota | Descrição | Acesso |
|--------|------|-----------|--------|
| GET | /auth/me | User, modules, permissions, **menu** (filtrado) | Autenticado |
| GET | /menu | Menu filtrado (alternativa) | Autenticado |
| GET | /admin/modules | Lista módulos | DEV |
| POST | /admin/modules | Criar módulo | DEV |
| PUT | /admin/modules/:id | Atualizar módulo | DEV |
| DELETE | /admin/modules/:id | Remover módulo | DEV |
| GET | /admin/permissions | Lista permissões | admin.roles.manage |
| POST | /admin/permissions | Criar permissão | DEV |
| PUT | /admin/permissions/:id | Atualizar permissão | DEV |
| DELETE | /admin/permissions/:id | Remover permissão | DEV |
| GET | /admin/roles | Lista roles | admin.roles.manage |
| GET | /admin/roles/:id/permissions | Permissões da role | admin.roles.manage |
| PUT | /admin/roles/:id/permissions | Atribuir permissões à role | admin.roles.manage |
| GET | /admin/menu | Lista menu_items | DEV |
| POST | /admin/menu | Criar item | DEV |
| PUT | /admin/menu/:id | Atualizar item | DEV |
| DELETE | /admin/menu/:id | Remover item | DEV |

---

## 5. Regras de negócio

- **DEV**: bypass total em todas as verificações de permissão
- **MASTER**: todas as permissões via role_permissions; pode cadastrar usuários e gerenciar roles
- **Usuário id 2**: MASTER, único usuário inicial, empresa_id=3
- **Demais roles**: permissões atribuídas por MASTER ou DEV
- **Apenas DEV** pode editar a role MASTER
- **Role DEV** só aparece em listagens para usuários com role DEV
- **Módulos e menu**: apenas DEV pode criar/editar/excluir (configuração do sistema)

---

## 6. Estrutura das tabelas (MySQL)

### modules
- id, `key`, label, description, icon, `order`, created_at, updated_at

### permissions
- id, module_id, `key`, description, module (string), created_at, updated_at

### role_permissions
- role_id, permission_id (PK composta)

### menu_items
- id, parent_id, module_key, label, path, icon, `order`, permission, permission_create, permission_update, permission_update_partial, permission_delete, created_at, updated_at

---

## 7. Verificação pós-migration

1. `GET /auth/me` com usuário id 2 (DEV) → deve retornar menu completo e todas as permissões
2. `GET /auth/me` com usuário MASTER (após migration) → modules vazio, permissions vazio, menu vazio
3. Após DEV atribuir permissões a MASTER via PUT /admin/roles/:id/permissions → MASTER passa a ver menu e módulos conforme permissões
