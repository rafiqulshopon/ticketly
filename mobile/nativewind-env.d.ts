/// <reference types="nativewind/types" />

// NativeWind v4.2.6 ships no `*.css` module declaration (and `nativewind/types`
// is a silent no-op in this version), so the side-effect `import "@/global.css"`
// in app/_layout.tsx needs one. RN 0.86's @types already declare `className` on
// core components natively, so no extra augmentation is required for that.
declare module "*.css";
