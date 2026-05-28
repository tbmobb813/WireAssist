export default {};
export const useRouter = () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
