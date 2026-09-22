export type StartPartSource = "dm" | "channel";
export type StartSource = StartPartSource | "hybrid";

export const resolveStartSource = (
  linkSource: StartPartSource | undefined,
  screenshotSource: StartPartSource | undefined,
): StartSource | undefined => {
  if (linkSource === undefined || screenshotSource === undefined) {
    return undefined;
  }
  if (linkSource === screenshotSource) {
    return linkSource;
  }
  return "hybrid";
};
