// Hometown moments reach brands: counsel signed off on the copy rules
// (October 2026). WALKOFF_HOMETOWN=0 turns them off for brands; Walkoff
// operators still get them, to test.

export const hometownLive = (env: Record<string, string | undefined> = process.env) => env.WALKOFF_HOMETOWN !== "0";
