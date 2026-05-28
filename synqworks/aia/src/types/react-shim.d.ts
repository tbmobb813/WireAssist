// Minimal local shim for `react` named exports to avoid build-time
// resolution problems with the ambient @types/react package in this
// workspace during iterative typing work.
//
// This is intentionally conservative and should be replaced with the
// official `@types/react` types (or a proper module augmentation) as a
// long-term fix. For now it prevents tsc from reporting hundreds of
// "Module 'react' has no exported member ..." errors so we can focus
// on real implicit-any issues in the app code.

declare module "react" {
    // Basic React types used in the codebase
    export type ReactNode = any;
    export type ReactElement = any;
    export type FC<P = any> = (props: P & { children?: ReactNode }) => ReactElement | null;
    export type ComponentType<P = any> = FC<P> | any;

    // Minimal Component base class to support class components / error boundaries
    export class Component<P = any, S = any> {
        props: P;
        state: S;
        context: any;
        refs: any;
        constructor(props: P);
        setState(partial: Partial<S> | ((prevState: S) => Partial<S>), callback?: () => void): void;
        forceUpdate(callback?: () => void): void;
        render(): ReactNode | null;
    }
    export type ComponentClass<P = any> = new (props: P) => Component<P, any>;

    // Common hooks
    export function useState<S = any>(initialState: S | (() => S)): [S, (s: S | ((prev: S) => S)) => void];
    export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    export function useRef<T = any>(initial?: T | null): { current: T | null };
    export function useMemo<T = any>(factory: () => T, deps?: any[]): T;
    export function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T;
    export function useContext<T = any>(context: any): T;
    export function useReducer<R extends (...args: any[]) => any, I = any>(reducer: R, initial: I): [any, (...args: any[]) => void];
    export function startTransition(callback: () => void): void;

    // JSX helpers
    export const Fragment: any;
    export const StrictMode: any;
    export const Suspense: any;
    export const lazy: any;
    export const memo: <T extends any>(c: T) => T;

    // createElement for older code paths
    export function createElement(type: any, props?: any, ...children: any[]): ReactElement;

    // For test helpers
    export function act(callback: () => any): any;

    // Common DOM types (lightweight)
    export type MouseEvent = any;
    export type KeyboardEvent = any;
    export type FormEvent = any;
    export type CSSProperties = Record<string, string | number>;
}

// Provide default export so `import React from 'react'` works in some files
declare module "react" {
    const React: typeof import("react");
    export default React;
}
