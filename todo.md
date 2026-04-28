# Commission Tracker - Project TODO

## Core Features
- [x] Data entry form for deals (client name, date, deal amount, cash collected, new/existing, showed, notes)
- [x] Automatic commission calculation (2.5% of cash collected + $20 per new client that showed)
- [x] Monthly statement views with all deals and statistics
- [x] Edit functionality for all deal entries
- [x] Admin panel for commission settings (percentage and show rate)
- [x] Payout tracking system for admin to record commission payments
- [x] Fully Paid status tracking for payment plan deals
- [x] Separate tracking for new vs existing clients
- [x] Dashboard with monthly navigation
- [x] Statistics summary (total revenue, new/existing cash, total commissions, paid out)

## Database Schema
- [x] Deals table with all required fields
- [x] Commission settings table
- [x] Payouts table for tracking payments

## Backend API
- [x] CRUD operations for deals
- [x] Commission calculation logic
- [x] Admin settings management
- [x] Payout recording and tracking
- [x] Monthly statistics aggregation

## Frontend UI
- [x] Professional dashboard layout
- [x] Clean data entry form
- [x] Monthly statement view with deal list
- [x] Edit deal modal/form
- [x] Admin panel interface
- [x] Statistics cards/summary
- [x] Month navigation controls

## Design Requirements
- [x] Professional and neat appearance
- [x] Clean, modern UI suitable as foundation for future development

## Updates - Opportunity Tracking
- [x] Allow logging opportunities without deal amount (person just showed, didn't close)
- [x] Add "closed" field to track if opportunity resulted in a sale
- [x] Update commission logic: $20 ONLY if showed but did NOT close
- [x] Update commission logic: 2.5% of cash collected ONLY if closed (no $20)
- [x] Make deal amount/cash collected optional (only required if closed)
- [x] Update dashboard to show opportunities vs closed deals
- [x] Update statistics to reflect new commission structure

## Updates - Payment Plan & Inline Editing
- [x] Add inline checkbox editing on dashboard for showed/closed status
- [x] Add payment plan fields (isPaymentPlan, totalMonths, monthlyAmount)
- [x] Create recurring monthly entries when payment plan is set
- [x] Add "paid off early" option to remove future entries
- [x] Add "stopped paying" option to cancel remaining payments
- [x] Link related payment entries together (parentDealId)
- [x] Show payment plan status and remaining months on dashboard
- [x] Allow editing deal amount and cash collected from dashboard

## Major Update - Multi-Role Commission System

### Database Changes
- [x] Add team_members table (id, name, role: closer/setter/payroll, commission_rate, active)
- [x] Add commission_rates table for time-based rates (member_id, rate, start_date, end_date)
- [x] Update deals table to link to closer and setter
- [x] Add pay_periods table (id, start_date, end_date, month, year, period_number)
- [x] Add payroll_entries table (member_id, pay_period_id, amount_owed, amount_paid, paid_date, paid_by)

### Closer Commission Sheet
- [x] Form for closers to enter: client, date, showed, prepared, closed, amounts, setter selection
- [x] Setter dropdown (Jake Glass + future setters + "None/Self-generated")
- [x] Auto-calculate closer commission (15% Jan-Feb, 10% March+)
- [x] Auto-create setter entry when setter is selected

### Setter Commission (Auto-generated)
- [x] Auto-create from closer entries
- [x] 3% of cash collected when closed
- [x] $20 show commission only if showed AND prepared
- [x] View-only for setters (entries created by closers)

### Dashboard
- [x] Closer competition leaderboard (cash collected, revenue, sales count)
- [x] Setter stats (show percentage, preparation percentage)
- [x] Current month view

### Payroll Tab (Ariana)
- [x] View all team members with monthly totals
- [x] Commission owed per person
- [x] Mark as paid (twice monthly pay periods)
- [x] Update stats when paid

### Historical Year View
- [ ] Monthly breakdown for the year (Future enhancement)
- [ ] Comparison across months (Future enhancement)

### Team Members to Add
- [x] Steve Lapa (Closer, 15% Jan-Feb, 10% March+)
- [x] Jhalil Timazee (Closer, 15% Jan-Feb, 10% March+)
- [x] Jake Glass (Setter, 3% + $20 show)
- [x] Ariana (Payroll Admin)

### Branding - Trader Foundation
- [x] Apply black and gold (#c7ab77) color scheme
- [x] Add Trader Foundation logo
- [x] Update app title to "Trader Foundation"
- [x] Dark theme with gold accents

### Dynamic Team & Motivational UI
- [x] Dynamic team member management (add closers/setters anytime)
- [x] Company-wide statistics dashboard
- [x] $250,000 monthly goal with visual progress tracking
- [x] Motivational progress bars and milestone celebrations
- [x] Competitive leaderboard with rankings
- [x] Psychological motivation elements (streaks, achievements)


## Data Seeding
- [x] Seed team members (Steve Lapa, Jhalil Timazee, Jake Glass)
- [x] Create 10 sample deal entries to demonstrate the system


## Bonus/Deduction & Role-Based Access

### Bonus/Deduction System
- [x] Add adjustments table (member_id, amount, type: bonus/deduction, reason, created_by, created_at, month, year)
- [x] Payroll can add bonus or deduction for any team member
- [x] Must include explanation/reason
- [ ] Appears immediately on closer/setter dashboard
- [ ] Shows in their commission breakdown with explanation

### Role-Based Access Control
- [ ] Closers only see their own deals and stats
- [ ] Setters only see deals where they were the setter
- [ ] Dashboard shows only personal performance
- [ ] Each role sees only their own payroll info
- [x] Admin/Payroll sees everything


## My Deals & Notifications
- [x] My Deals page for closers to view and edit their deals
- [x] Notes editing functionality with sync to setter view
- [x] Notifications table in database
- [x] Notify setter when notes are updated on their contact
- [x] Notify team member when payroll marks them paid
- [x] Payment notification includes amount and statement breakdown
- [x] Notification bell/indicator in UI


## UI Improvements
- [x] Add thin gold borders to unchecked checkboxes for visibility
- [x] Add instructions/help text for each section for new employees


## Payroll Dashboard Expansion
- [x] Dedicated payroll dashboard (no sales stats, just payments)
- [x] Support for different payee types:
  - [x] Closers/Setters - Commission-based
  - [x] Coaches - Fixed salary (Elliot Gumbs: $2,050 bi-weekly)
  - [x] W2 Employees - Fixed salary (Erin Chawla: $2,500 bi-weekly)
  - [x] Vendors - Fixed amounts (Shyft Media: $1,800/month filming, $500/month ads)
- [x] Autopay indicator for recurring automatic payments
- [x] Payment schedule view
- [x] Seed data for Elliot Gumbs, Erin Chawla, Shyft Media
- [x] Leo Gonzalez as On-Demand Coach


## Owner Dashboard
- [x] Comprehensive owner view with all data
- [x] Payroll breakdown visual by category:
  - [x] Marketing (Shyft Media)
  - [x] Coaching (Elliot Gumbs)
  - [x] Sales (Closers + Setters commissions)
  - [x] Operations (W2 employees)
- [x] Company-wide financials (revenue, payroll costs, margins)
- [x] Full sales dashboard with leaderboards and goal tracking


## Payment Type Tracking System

### Payment Types
- [x] Pay In Full option with provider selection (Fanbasis, Other with text field)
- [x] Payment Plan option with provider selection (Fanbasis, Denefits)
- [x] Buy Now Pay Later (BNPL) option with provider selection (Climb, Shifi, Split It)

### Payment Plan Features
- [x] Down payment field
- [x] Number of months field
- [x] Monthly payment amount field
- [x] Auto-add client to next month for tracking
- [x] "Paid" checkbox with confirmation dialog
- [x] Payment progress display (e.g., "2 of 6 payments paid")
- [x] Commission only paid when "Paid" is checked
- [x] Auto-add to next month when marked paid

### BNPL Features
- [x] BNPL fee field
- [x] Cash Collected = Revenue - Fee calculation
- [x] Commission calculated on net amount

### Payroll Enhancements
- [x] Autopay toggle for any payee
- [x] Add any employee type (closer, setter, coach, on-demand coach, W2, vendor)
- [x] Add Leo Gonzalez as On-Demand Coach


## Payment Plan Logic Fix
- [ ] Fix: Don't create all payment plan entries upfront
- [ ] Only record down payment when deal is created
- [ ] Add next month entry only when current payment is marked as collected
- [ ] If client stops paying, no future entries are created


## Role-Based Access Control
- [x] Closers only see their own deals and stats on Dashboard
- [x] Closers only see My Deals page with their deals
- [x] Setters only see deals where they were the setter
- [x] Setters see their auto-generated commissions
- [x] Payroll users only see Payroll Dashboard and Commission Payouts
- [x] Admin sees everything (current behavior)
- [x] Hide navigation items based on user role

## Payment Plan Confirmation Dialog
- [x] Add confirmation dialog when marking payment as collected
- [x] Show payment details in confirmation (client name, amount, payment number)
- [x] Prevent accidental clicks with explicit confirm/cancel buttons

## Payment Plan Monthly View
- [x] Create dedicated page for payment plan clients due this month
- [x] Show all pending payment plan entries for current month
- [x] Easy "Mark Paid" button for each entry
- [x] Show payment progress (X of Y payments)
- [x] Filter by closer if admin

## Payment Plan Auto-Calculation
- [x] Auto-calculate monthly payment: (Total Deal Amount - Down Payment) / Number of Months
- [x] Keep field editable for manual adjustments
- [x] Update calculation when total, down payment, or months change


## Client Details Popup
- [x] Add popup dialog when clicking on client name in My Deals
- [x] Show all deal information: payment type, amounts, provider, dates
- [x] Show payment plan progress if applicable
- [x] Show notes and status checkboxes


## Delete Deal Functionality
- [x] Add delete button to client details popup
- [x] Show confirmation dialog before deleting
- [x] Remove deal and associated payment plan entries

## Edit Deal Capability
- [x] Add edit mode to client details popup
- [x] Allow editing all deal fields (client name, amounts, payment type, etc.)
- [x] Save changes and refresh data

## Reporting Page (High-Ticket Sales Metrics)
- [x] Create new Reports page in navigation
- [x] Total Revenue & Cash Collected
- [x] Average Deal Size
- [x] Close Rate (Showed vs Closed)
- [x] Revenue by Payment Type (Pay In Full, BNPL, Payment Plan)
- [x] Cash Flow Projection from Payment Plans
- [x] Top Performers by Revenue
- [x] Show-to-Close Conversion Rate
- [x] Commission Payout Ratio
- [x] Visual charts for key metrics
- [x] Filter by month/year

## Remove New Client Checkbox
- [x] Remove unnecessary new client checkbox from NewDeal form

## Collapsible Instructions
- [x] Convert How to Fill Out form instructions to collapsible accordion

## Duplicate Mobile Headers Fix
- [x] Hide page titles on mobile (DashboardLayout shows them)
- [x] Fixed on Dashboard, MyDeals, PayrollDashboard, PaymentPlans, Reports, Payouts, Settings, NewDeal

## Collapsible Instructions on All Pages
- [x] MyDeals - instructions now collapsible
- [x] PayrollDashboard - instructions now collapsible
- [x] NewDeal - instructions already collapsible

## Mobile Button Size
- [x] Made sidebar toggle button larger (h-12 w-12) with better visibility
- [x] Added primary color accent and border for easier tapping


## Payment Plan Logic Fix (Correct Implementation)
- [x] Payment plan entries should show in their DUE month (Feb payment in Feb view, etc.)
- [x] Add "Collect Payment" button for payment plan entries (separate from Paid checkbox which is for payroll)
- [x] When payment is collected, create next month's entry
- [x] Show both new deals AND payment plan payments due in each month's view
- [x] Add "Recurring Revenue" stat showing expected monthly income from active payment plans

## Mobile Header Fix
- [x] Removed duplicate page title from mobile header
- [x] Mobile header now only shows sidebar toggle button


## Email/Password Authentication System
- [x] Replace OAuth with email/password login
- [x] Create registration page for new users
- [x] Create login page with email/password
- [x] Hash passwords securely (bcrypt)
- [x] Create session/JWT token system
- [x] Add logout functionality

## Admin User Permissions Management
- [x] Add permissions field to users table (JSON array of allowed pages)
- [x] Create admin panel to manage users
- [x] Allow admin to set which tabs each user can access
- [x] Update navigation to only show permitted tabs
- [x] Protect routes based on user permissions

## Initial User Accounts
- [x] Vlad@traderfoundation.net (Admin - full access) - Created with password 'admin123'
- [ ] Ariana@traderfoundation.co - Admin can create via User Management
- [ ] Steve@traderfoundation.net - Admin can create via User Management
- [ ] Jake@traderfoundation.net - Admin can create via User Management
- [ ] jhalil.t@traderfoundation.co - Admin can create via User Management


## Self-Registration System Update
- [x] Clear all existing user accounts
- [x] Allow self-registration (remove admin-only user creation)
- [x] Restrict registration to @traderfoundation.net and @traderfoundation.co emails only
- [x] Add role selection during registration (Closer, Setter, Payroll, Admin)
- [x] Auto-assign permissions based on selected role
- [x] Update Login page to show registration option


## Login Authentication Fix
- [x] Fixed login system for email/password users
- [x] Updated SDK authenticateRequest to look up users by openId in database first
- [x] Set openId field for existing email/password users (format: user-{id})
- [x] Session token creation now works with email/password authentication
- [x] Admin account (vlad@traderfoundation.net) can now log in successfully


## Complete Role-Based Access Control Implementation
- [x] Update user roles to include: Closer, Setter, Payroll, Admin (not just user/admin)
- [ ] Setter Dashboard: Show only deals where they are assigned as setter
- [ ] Setter Dashboard: Show their commission earnings (3% + $20 show bonus)
- [ ] Setter Dashboard: Show their performance stats (show rate, prep rate)
- [ ] Closer Dashboard: Show only their own deals
- [ ] Closer Dashboard: Show their commission earnings (15%/10%)
- [ ] Closer Dashboard: Show their performance stats and leaderboard position
- [ ] Payroll Dashboard: Show all team members' commissions owed
- [ ] Payroll Dashboard: Hide sales performance metrics (focus on payments)
- [x] Admin Dashboard: Full access to all data and all pages
- [x] Update registration to properly set role field (closer/setter/payroll/admin)
- [ ] Filter API responses based on user role
- [ ] Link registered users to team_members table for commission tracking

## Domain Change: traderfoundation.net → traderfoundation.com
- [x] Update all email placeholders from .net to .com
- [x] Update admin email in database from vlad@traderfoundation.net to vlad@traderfoundation.com
- [x] Update all other user emails in database to .com

## Dashboard Reset - Fresh Start April 1st
- [x] Clear all deals/entries data
- [x] Clear all payment plan entries
- [x] Clear all commission payouts
- [x] Keep user accounts and team members intact
- [x] Verify dashboard shows $0 / empty state
- [x] Promote Jake Glass from setter to closer in team_members table

## Delete Duplicate Elliot Entry & Add Delete Functionality
- [x] Delete the duplicate Elliot entry from the database
- [x] Add delete button to deal entries in My Deals page
- [x] Add delete deal tRPC procedure on the backend (already existed)

## Coaching Sessions Module (On-Demand Coach)
- [x] Create coachingSessions table in schema (sessionDate, clientName, minutes, tradingLog, fuSession, fuAssignments, notes, recordingLink, isNoShow, noShowDate)
- [x] Create DB helpers for coaching sessions CRUD
- [x] Create tRPC procedures for coaching sessions
- [x] Build Coaching Sessions page with entry form and monthly table view
- [x] Recording link required - warn coach they won't get paid without it
- [x] Pay calculation: $0.90/minute + $15 per no-show
- [x] Integrate coaching pay into Payroll Dashboard (bi-weekly)
- [x] Add Coaching Sessions to sidebar navigation
- [ ] Write tests for coaching session logic

## Sidebar Navigation Reorganization
- [x] Reorganize sidebar into grouped sections: Sales, Payroll, Marketing, Admin
- [x] Sales section: Dashboard, New Entry, My Deals, Payment Plans
- [x] Payroll section: Payroll Dashboard, Commission Payouts, Coaching Sessions
- [x] Marketing section: Reports
- [x] Admin section: Settings, User Management

## Dashboard Redesign - 3 Tabs
### Tab 1: Company Performance
- [ ] Total Revenue (sum of all deal values)
- [ ] Total Cash Collected
- [ ] Marketing Cost (Facebook ad spend - manual entry for now)
- [ ] ROAS calculation (Revenue / Ad Spend)
- [ ] New Monthly Revenue (payment plan monthly amounts + benefits deals recurring)
- [ ] Monthly revenue collected breakdown

### Tab 2: Sales Team Breakdown
- [ ] Per-salesperson performance cards (head-to-head comparison)
- [ ] Show rate (appointments shown / total booked)
- [ ] Live calls count
- [ ] Close rate (deals closed / live calls)
- [ ] Revenue per closer
- [ ] Sharp visual comparison layout

### Tab 3: Payroll Overview
- [ ] Full breakdown of what's owed this month
- [ ] What's been paid (marked by Ariana)
- [ ] What's still outstanding
- [ ] Covers commissions, coaching, vendors, W2

## Subscription Tracking System
- [x] Create subscriptions table (clientName, monthlyAmount, closerId, startDate, active, cancelledDate)
- [x] Create subscriptionVerifications table (subscriptionId, month, year, isVerified, verifiedBy, verifiedAt)
- [x] DB helpers for subscription CRUD
- [x] tRPC procedures for subscriptions
- [x] Subscription entry form (closer signs up client with monthly amount)
- [x] Monthly verification workflow for Ariana (check off active subscribers)
- [x] Cancel subscription flow with notification to closer
- [x] 25% commission auto-calculated and added to closer's pay
- [x] Subscription commissions appear on closer's report (auto-included via getCloserStats)
- [x] Monthly integrity audit reminder for Ariana (5 random subscribers to spot-check via Integrity Audit tab)

## Dashboard Redesign - 3 Tabs
- [x] Tab 1: Company Performance (revenue, collected, marketing cost, ROAS, new monthly revenue)
- [x] Tab 2: Sales Team Breakdown (show %, live calls, close %, head-to-head comparison)
- [x] Tab 3: Payroll Overview (what's owed, what's paid, outstanding)
- [x] Fix CoachingSessions import error in App.tsx

## Leo Gonzalez - Coach Account & Dashboard
- [x] Add "coach" role to user roles enum in schema
- [x] Create Leo's account (leo@traderfoundation.com, coach role)
- [ ] Build coach-specific dashboard with session entry form (like the spreadsheet)
- [ ] Monthly session history table view
- [ ] Pay calculation display ($0.90/min + $15 no-shows)
- [ ] $2,000/month cap enforcement and progress indicator
- [ ] Overall payout history report
- [ ] Coach-specific sidebar navigation (only sees their coaching pages)
- [ ] Demo Leo's view

## Remove Setter Role
- [x] Remove setter from user roles enum
- [x] Remove setter references from DashboardLayout, UserManagement, routers, db helpers
- [x] Remove setter-specific UI/logic (setter commission, setter stats, etc.)
- [x] Update any existing setter users to closer

## Simplify Sales Tracking
- [x] Remove call tracking, show rates, appointment metrics from Dashboard
- [x] Focus Dashboard on: closed deals, revenue brought in, cash collected, ad spend, ROAS
- [x] Remove setter leaderboard from Dashboard
- [x] Simplify closer comparison to just deals closed + revenue

## Role-Specific Private Views
- [ ] Closer view: only their own deals, commissions, payouts (no other closers' data)
- [ ] Coach view: session entry, session history, pay summary with $2K cap, payout history
- [ ] Payroll view: payroll dashboard, subscription verification, commission payouts, payment plans
- [ ] Admin view: everything (company performance, all closers, payroll, settings)
- [ ] Privacy: no user can see another user's data unless admin

## Register All Employees
- [x] Register Steve Lapa (steve@traderfoundation.com) - closer
- [x] Register Jhalil Timazee (jhalil@traderfoundation.com) - closer
- [x] Register Jake Glass (jake@traderfoundation.com) - closer
- [x] Register Ariana (ariana@traderfoundation.com) - payroll
- [x] Register Leo Gonzalez (leo@traderfoundation.com) - coach (already exists)
- [x] All passwords: Trader2026!
- [x] Link user accounts to team members (closers linked, Leo linked to payee, Ariana has payroll access)

## New Entry Form Updates
- [x] Remove Setter field entirely from New Entry form
- [x] Make Closer dropdown only visible to admin (Vlad)
- [x] Auto-assign closer based on logged-in user for closer role

## New Employee Accounts
- [x] Register Elliot Gumbs (elliot@traderfoundation.com) - coach, password: Trader2026!
- [x] Register Erin Chawla (erin@traderfoundation.com) - coach (head of organic), password: Trader2026! (keep existing W2 salary unchanged)
- [x] Update Ariana's name to Ariana Tayman in database

## Password Update
- [x] Change all employee passwords to "Trader"

## Bug Fixes
- [x] Fix HTML nesting error: p tag cannot contain a nested div on dashboard page

## Closer UX Improvements
- [x] My Deals: Remove profile dropdown for closers, auto-load their deals based on login- [x] New Entry: Add Sale vs Subscription selector at the top- [x] New Entry: Show relevant fields based on entry type selection
- [x] Fix payroll role denied access to Commission Payouts page

## Closer Dashboard Enhancements
- [x] Add revenue tracker with $100K goal progress bar
- [x] Show cash collected for the month
- [x] Show subscription count and 25% monthly recurring earnings
- [x] Show full stats (deals, shows, closes, close rate, etc.)
- [x] Show leaderboard/standings compared to other closers

## Coaching Updates
- [ ] Elliot is a regular coach (not on-demand) - no pay for no-shows
- [ ] Recording link should be optional (no penalty)

## Payment Processor & Sample Data
- [x] Replace generic BNPL field with specific payment processors: Split-It, Fanbasis, Climb, ClarityPay, HFD, Elective, Other
- [x] Categories: Full Pay (upfront) | In-House Payment Plan (Fanbasis) | BNPL (Climb, ClarityPay, HFD, Elective, Split-It)
- [x] Add payment method breakdown stats per closer on dashboard
- [x] Seed March sample data for closers (Steve, Jhalil, Jake)
- [x] Seed March sample data for coaches (Leo, Elliot)
- [x] Include mix of full pays, in-house payment plans, and BNPL deals in sample data
- [x] Update New Entry form to use payment processor dropdown
- [x] Build enhanced closer dashboard with $100K revenue goal, leaderboard, all stats

## Sale vs Subscription Entry Type
- [x] Add Sale/Subscription selector at the top of New Entry form
- [x] Show sale-specific fields when Sale is selected (deal amount, payment type, etc.)
- [x] Show subscription-specific fields when Subscription is selected (monthly amount, platform, etc.)
- [x] Update backend to handle entry type distinction
- [x] Ensure existing deal creation still works for sales

## Coaching Session Form Fix
- [x] Remove "not getting paid" warning for salaried coaches (Elliot)
- [x] Make recording link optional for all coaches (no penalty warning)
- [x] Differentiate salaried coaches vs on-demand coaches (Leo) in the form
- [x] Salaried coaches: session logging is for tracking only, not payment
- [x] On-demand coaches: session logging determines per-session pay

## Password Change Feature
- [x] Add backend changePassword procedure (verify current password, hash new password, update DB)
- [x] Build Change Password UI accessible from sidebar/profile menu
- [x] Validate new password (min length, confirmation match)
- [x] Show success/error feedback to user
