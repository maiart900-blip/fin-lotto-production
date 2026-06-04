# FIN LOTTO R+ 

## Enterprise Online Lottery & Casino Network Core Software

**Hybrid Wallet | Auto-Purge Storage | Agent Settlement Engine**

---

## Overview

FIN LOTTO R+ is a comprehensive enterprise-grade platform for managing online lottery and casino network operations. Built with modern technologies and designed for scalability, security, and multi-tenant architecture.

### Core Capabilities

- **Hybrid Cashier System** - Unified wallet management for deposits, withdrawals, and gaming transactions
- **Seamless API Architecture** - Ready for integration with external casino/slot providers (PG Soft, Joker, Pragmatic, etc.)
- **Agent Network Management** - Multi-tier downline structure with Position Taking (PT) and commission calculation
- **Automated Settlement Engine** - Weekly settlement cycles with profit/loss distribution
- **Real-time Notification System** - LINE Notify and Telegram Bot integration for admin alerts
- **Data Retention & Archiving** - Automated cleanup policies for storage optimization

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL) |
| Storage | Vercel Blob |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui |
| Authentication | Custom role-based with Super Admin support |
| Deployment | Vercel |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIN LOTTO R+ Platform                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Customer  │  │    Admin    │  │    Super Admin      │  │
│  │   Portal    │  │   Backend   │  │   Master Control    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │              Centralized Wallet Service               │  │
│  │  - Deposit/Withdraw Processing                        │  │
│  │  - Seamless API Callbacks (Casino/Slots)              │  │
│  │  - Credit Transaction Logging                         │  │
│  │  - Optimistic Locking (Race Condition Prevention)     │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │                  Data Layer                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │  │
│  │  │ Supabase │  │  Vercel  │  │    Audit Logs    │    │  │
│  │  │    DB    │  │   Blob   │  │   (90-day TTL)   │    │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Modules

### 1. Hybrid Cashier System
- Manual deposit/withdraw request processing
- Payment gateway integration ready
- Slip verification with duplicate detection
- Real-time admin notifications

### 2. Agent Network
- Multi-tier downline management
- Position Taking (PT) percentage configuration
- Commission rate settings per agent
- Credit limit controls

### 3. Settlement Engine
- Weekly settlement cycle processing
- Profit/Loss calculation per agent
- PT share and commission computation
- Settlement confirmation with audit trail

### 4. Security Features
- Role-based access control (RBAC)
- Route guards for sensitive pages
- Optimistic locking for financial transactions
- Comprehensive audit logging

### 5. Storage Management
- Image compression (200-300KB target)
- Automated data retention policies
- 90-day audit log cleanup
- 180-day lottery bet archival

---

## Deployment

The application is deployed on Vercel with automatic CI/CD from the main branch.

### Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Optional: Notifications
LINE_NOTIFY_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Security
CRON_SECRET=
```

---

## Security Notes

- All financial operations use optimistic locking to prevent race conditions
- Sensitive routes require Super Admin authentication
- Audit logs track all administrative actions
- Data retention policies ensure compliance and storage optimization

---

## License

Proprietary Software - All Rights Reserved

---

**FIN LOTTO R+ - Enterprise Network Core Software**  
*Version 1.0.0 - Production Ready*
