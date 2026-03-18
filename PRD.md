# Prompt OS - Professional Prompt Management System

A comprehensive web-based prompt library and enhancement system that helps users create, organize, enhance, and manage prompts for AI interactions across coding, image generation, video creation, research, planning, and agent development.

**Experience Qualities**:
1. **Professional** - Enterprise-grade interface with organized workflows that feel like developer tooling
2. **Intelligent** - Smart prompt enhancement with GPT integration and structured output contracts
3. **Efficient** - Quick access to prompts with search, favorites, and category organization

**Complexity Level**: Complex Application (advanced functionality with multiple views)
This is a full-featured prompt management system with multiple enhancement engines, category-based organization, version control, favorites, search, editing capabilities, and AI-powered enhancement - requiring sophisticated state management and multiple interconnected features.

## Essential Features

### Prompt Library System
- **Functionality**: Browse and organize prompts by category (coding, image, video, research, planning, agents)
- **Purpose**: Centralized access to pre-built and custom prompts
- **Trigger**: User opens app or navigates categories
- **Progression**: Select category → Browse prompts → Preview content → Copy or enhance
- **Success criteria**: All prompts load, categories filter correctly, copy works instantly

### AI Prompt Optimizer
- **Functionality**: Analyzes prompts across 5 dimensions (clarity, specificity, structure, completeness, effectiveness) and provides improvement suggestions
- **Purpose**: Help users understand prompt quality and get AI-powered optimization recommendations
- **Trigger**: User clicks "Optimize" button on any prompt
- **Progression**: Select prompt → Click optimize → AI analyzes → View scores and feedback → Copy or apply optimized version
- **Success criteria**: Analysis completes in <10s, provides actionable feedback, optimized version shows measurable improvements

### GPT-Powered Prompt Enhancer
- **Functionality**: Takes any prompt and enhances it using GPT with mode-specific schemas
- **Purpose**: Transform basic prompts into structured, comprehensive prompts
- **Trigger**: User clicks "Enhance" button on any prompt
- **Progression**: Select prompt → Click enhance → Choose mode → AI processes → View enhanced result → Copy or save
- **Success criteria**: Enhancement completes in <5s, follows strict schema, output is significantly improved

### Reference Image Attribute Extractor
- **Functionality**: Extracts detailed attributes from image descriptions (subject, pose, lighting, etc.)
- **Purpose**: Break down reference images into usable prompt components
- **Trigger**: User enters image description in Image/Video mode
- **Progression**: Enter description → Extract attributes → Review extracted data → Integrate into prompt
- **Success criteria**: Extracts 11+ attributes accurately, formats for LLM consumption

### Real Camera Physics Module
- **Functionality**: Applies professional camera physics to image/video prompts
- **Purpose**: Create photorealistic prompts with authentic camera settings
- **Trigger**: Automatically applied in Image/Video enhancement modes
- **Progression**: User enhances image/video prompt → Camera physics applied → Technical details added → Final output generated
- **Success criteria**: Includes optics, sensor, lighting, and motion physics details

### Custom Prompt Management
- **Functionality**: Create, edit, duplicate, version, and favorite prompts
- **Purpose**: Personalize the prompt library with user-specific content
- **Trigger**: User clicks create/edit/duplicate/favorite buttons
- **Progression**: Select action → Modify content → Save → Prompt persists across sessions
- **Success criteria**: All CRUD operations work, data persists using KV storage, versions track changes

### Global Structured Contract
- **Functionality**: Enforces 10-section structure on ALL enhanced prompts
- **Purpose**: Ensure consistent, comprehensive output quality
- **Trigger**: Applied automatically during any enhancement
- **Progression**: User enhances → Contract enforced → Sections validated → Structured output delivered
- **Success criteria**: Every enhanced prompt has all 10 required sections, no deviations

### Search and Filter
- **Functionality**: Search prompts by title, content, tags; filter by category
- **Purpose**: Quickly find relevant prompts in large libraries
- **Trigger**: User types in search bar or selects category
- **Progression**: Enter query → Results filter in real-time → Select result → Use prompt
- **Success criteria**: Search responds instantly, matches partial terms, filters combine correctly

## Edge Case Handling

- **Empty Library** - Show welcome screen with quick start guide and sample prompts
- **Long Prompts** - Truncate display text, show full content in preview panel
- **Failed Enhancement** - Show error toast, retain original prompt, offer retry
- **Duplicate Titles** - Auto-append version number or timestamp
- **Missing Categories** - Default to "Personal" category, allow creation
- **Offline Usage** - All data stored locally, no server required
- **Large Storage** - Implement pagination for 100+ prompts
- **Invalid JSON** - Validate on save, show specific error messages

## Design Direction

The design should evoke a professional developer tool with the sophistication of VS Code or Linear - clean, organized, with excellent information hierarchy. It should feel like a command center for prompt engineering, where power users can work quickly and efficiently.

## Color Selection

A refined, developer-focused palette with deep purple as the brand color to evoke creativity and intelligence.

- **Primary Color**: Deep Purple `oklch(0.45 0.18 285)` - Represents creativity, intelligence, and premium tooling
- **Secondary Colors**: 
  - Slate Gray `oklch(0.25 0.01 255)` for structural elements and backgrounds
  - Cool Gray `oklch(0.35 0.02 260)` for secondary actions
- **Accent Color**: Electric Violet `oklch(0.65 0.22 290)` - High-energy highlight for CTAs and active states
- **Foreground/Background Pairings**:
  - Background (Light Gray #FAFAFA / oklch(0.98 0 0)): Dark Text (oklch(0.15 0 0)) - Ratio 15.8:1 ✓
  - Primary (Deep Purple): White text (oklch(1 0 0)) - Ratio 7.2:1 ✓
  - Accent (Electric Violet): White text (oklch(1 0 0)) - Ratio 4.9:1 ✓
  - Card (White oklch(1 0 0)): Dark Text (oklch(0.15 0 0)) - Ratio 18.5:1 ✓

## Font Selection

Typography should communicate technical precision and professional craftsmanship - combining a geometric sans for UI elements with a monospace for prompt content.

- **Typographic Hierarchy**:
  - H1 (Page Title): Space Grotesk Bold / 32px / -0.02em letter spacing
  - H2 (Category Headers): Space Grotesk SemiBold / 24px / -0.01em letter spacing  
  - H3 (Prompt Titles): Space Grotesk Medium / 18px / normal letter spacing
  - Body (UI Text): Space Grotesk Regular / 14px / normal letter spacing
  - Prompt Content: JetBrains Mono Regular / 13px / normal letter spacing / 1.6 line height
  - Labels: Space Grotesk Medium / 12px / 0.01em letter spacing / uppercase

## Animations

Animations should feel snappy and purposeful like a native application - quick transitions for feedback, smooth expansions for content reveals, and subtle motion to guide attention without distraction.

Key animations:
- Category selection: 150ms ease-out color shift
- Prompt card hover: 200ms ease-out elevation increase
- Panel slide-in: 300ms ease-out transform
- Enhancement loading: Pulsing gradient animation
- Copy feedback: Quick scale bounce (200ms)
- Search results: Staggered fade-in (50ms delay per item)

## Component Selection

- **Components**:
  - **Sidebar**: Category navigation with icons (coding, image, video, research, planning, agents)
  - **Card**: Prompt display with title, preview, tags, and action buttons
  - **Dialog**: Full-screen prompt editor with syntax highlighting
  - **Tabs**: Mode switcher for enhancement (coding/image/video/research/planning/agent)
  - **Button**: Primary actions (enhance, copy, save), secondary (edit, duplicate), destructive (delete)
  - **Input/Textarea**: Search bar, prompt editing, reference image input
  - **Badge**: Category tags, version indicators, favorite stars
  - **ScrollArea**: Prompt list, content preview
  - **Separator**: Section dividers
  - **Tooltip**: Icon explanations, keyboard shortcuts

- **Customizations**:
  - Prompt card: Custom gradient border on hover, compact mode toggle
  - Code display: Syntax-highlighted prompt content using JetBrains Mono
  - Enhancement panel: Multi-step wizard with progress indicator
  - Category icons: Custom Phosphor icons mapped to each category

- **States**:
  - Buttons: Default (solid primary), hover (slightly lighter), active (pressed scale), disabled (muted opacity)
  - Cards: Default (flat), hover (elevated shadow + border glow), selected (accent border)
  - Inputs: Default (border), focus (accent ring + border color shift), error (destructive border)
  - Enhancement: Idle, processing (animated gradient), success (green check), error (red alert)

- **Icon Selection**:
  - Code (coding prompts): Terminal
  - Image: Image
  - Video: Video
  - Research: MagnifyingGlass
  - Planning: ListChecks
  - Agents: Robot
  - Enhance: Sparkle
  - Copy: Copy
  - Edit: PencilSimple
  - Duplicate: CopySimple
  - Favorite: Star (filled when active)
  - Delete: Trash
  - Search: MagnifyingGlass

- **Spacing**:
  - Page padding: p-8
  - Card padding: p-6
  - Button padding: px-4 py-2
  - Section gaps: gap-6
  - Grid gaps: gap-4
  - Inline elements: gap-2

- **Mobile**:
  - Sidebar collapses to bottom tab bar on mobile
  - Cards stack in single column
  - Dialog becomes full-screen sheet
  - Search bar sticky at top
  - Action buttons become floating action button menu
  - Reduced padding (p-4 instead of p-8)
  - Larger touch targets (min 44px)
