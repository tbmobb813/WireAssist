// Lightweight declaration shim for lucide-react used to silence TS errors
// during local typecheck. This file exports common icon names as `any` and
// provides a default export. Replace with proper types or upgrade the
// dependency later for a long-term fix.

declare module "lucide-react" {
    // Common icons used across the codebase (declare as `any`)
    export const X: any;
    export const Search: any;
    export const File: any;
    export const FolderOpen: any;
    export const Eye: any;
    export const EyeOff: any;
    export const Plus: any;
    export const Trash2: any;
    export const AlertCircle: any;
    export const Info: any;
    export const FileText: any;
    export const ChevronDown: any;
    export const ChevronRight: any;
    export const Clock: any;
    export const Filter: any;
    export const AlertTriangle: any;
    export const Bug: any;
    export const Zap: any;
    export const Download: any;
    export const Activity: any;
    export const Database: any;
    export const Cpu: any;
    export const HardDrive: any;
    export const RefreshCw: any;
    export const TrendingUp: any;
    export const Server: any;
    export const BarChart3: any;
    export const MessageCircle: any;
    export const MessageSquare: any;
    export const Tag: any;
    export const Move: any;
    export const Maximize2: any;
    export const RotateCcw: any;
    export const Keyboard: any;
    export const Terminal: any;
    export const FileCode: any;
    export const Settings: any;
    export const Rocket: any;
    export const ArrowRight: any;
    export const ArrowLeft: any;
    export const User: any;
    export const Check: any;
    export const Edit2: any;
    export const CheckCircle: any;
    export const Folder: any;
    export const ChevronsDownUp: any;
    export const ChevronsUpDown: any;
    export const Sparkles: any;
    export const Clipboard: any;
    export const GitBranch: any;
    export const Copy: any;
    export const Save: any;
    export const Palette: any;
    export const Code: any;
    export const Monitor: any;
    export const Power: any;
    export const PowerOff: any;
    export const MoveLeft: any;
    export const Calendar: any;
    export const Bot: any;
    export const DollarSign: any;
    export const TrendingDown: any;
    export const PieChart: any;
    export const Minus: any;
    export const Lightbulb: any;
    export const HelpCircle: any;
    export const ChevronUp: any;
    export const Hash: any;

    // A fallback default export for imports that rely on a default
    const __lucide_default: any;
    export default __lucide_default;
}
declare module "lucide-react" {
    import * as React from "react";

    // Provide lightweight component types for the icons used in the app to
    // avoid TypeScript cross-version type resolution issues during tests.
    export const Copy: React.FC<any>;
    export const Check: React.FC<any>;
    export const Sparkles: React.FC<any>;
    export const Clipboard: React.FC<any>;
    export const GitBranch: React.FC<any>;
    export const GitPullRequest: React.FC<any>;
    export const Brain: React.FC<any>;
    export const GitFork: React.FC<any>;

    // Fallback for other icons
    export const __esModule: boolean;
    export default {} as { [key: string]: React.FC<any> };
}
