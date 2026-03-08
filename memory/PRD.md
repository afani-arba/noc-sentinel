# NOC-SENTINEL - MikroTik Monitoring Tool

## Problem Statement
Build a MikroTik monitoring tool running on Ubuntu server with:
1. Login page (JWT auth)
2. Dashboard with Grafana Prometheus-like dark theme
3. PPPoE user monitoring (search, edit, add)
4. Hotspot user monitoring (search, edit, add)
5. Report page (daily/weekly/monthly, export to PDF)
6. Device management (add/remove)
7. Admin user management (3 roles: administrator, viewer, user)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI (Python) with JWT authentication
- **Database**: MongoDB with Motor async driver
- **PDF Export**: jsPDF + jspdf-autotable

## User Personas
- **Administrator**: Full access to all features, can manage users and devices
- **User**: Can manage PPPoE/Hotspot users, view devices, generate reports
- **Viewer**: Read-only access to all monitoring pages

## Core Requirements (Static)
- JWT-based authentication with bcrypt password hashing
- Role-based access control (RBAC)
- CRUD operations for PPPoE users, Hotspot users, Devices, Admin users
- Search/filter functionality for user tables
- Dashboard with real-time charts (traffic, system health, alerts)
- Report generation with PDF export

## What's Been Implemented (March 8, 2026)
- [x] Login page with split-screen design
- [x] Dashboard with bento grid layout, traffic charts, pie chart, system health, alerts
- [x] PPPoE Users page with search, status filter, add/edit/delete
- [x] Hotspot Users page with search, status filter, add/edit/delete
- [x] Reports page with period selector, charts, top users table, PDF export
- [x] Devices page with device cards, add/remove functionality
- [x] Admin page with user management and role assignment
- [x] Sidebar navigation with collapsible desktop mode
- [x] Glassmorphism header with user dropdown
- [x] Mock data seeding (25 PPPoE users, 25 hotspot users, 4 devices)
- [x] "Tactical Dark" theme following Grafana design guidelines

## Prioritized Backlog
### P0 (Critical) - Done
- All core features implemented

### P1 (High)
- Real MikroTik RouterOS API integration
- Real-time WebSocket updates for dashboard
- Pagination for large datasets

### P2 (Medium)
- User activity logs/audit trail
- Device health history charts
- Batch user operations (import/export CSV)
- Custom report templates

### P3 (Low)
- Email notifications for alerts
- Dark/Light theme toggle
- Multi-language support
- Mobile app

## Default Credentials
- Username: admin
- Password: admin123
