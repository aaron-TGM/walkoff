// Hometown moments reach brands once they launch: WALKOFF_HOMETOWN=1, after
// counsel signs off on the copy rules. Walkoff operators get them before
// that, to test.

export const hometownLive = (env: Record<string, string | undefined> = process.env) => env.WALKOFF_HOMETOWN === "1";
