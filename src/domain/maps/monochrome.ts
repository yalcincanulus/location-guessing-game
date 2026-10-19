import type { SKRSContext2D } from "@napi-rs/canvas";

/**
 * Turns everything drawn so far to greys by luminance (Rec. 709). Renderers pick their own black
 * and white palettes for anything that carries meaning; this only settles decoration such as
 * header art, avatars and name gradients.
 */
export const toMonochrome = (context: SKRSContext2D, width: number, height: number) => {
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = Math.round(
      0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!,
    );
    data[index] = luminance;
    data[index + 1] = luminance;
    data[index + 2] = luminance;
  }
  context.putImageData(image, 0, 0);
};
