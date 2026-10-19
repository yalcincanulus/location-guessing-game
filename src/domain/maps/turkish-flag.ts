import type { SKRSContext2D } from "@napi-rs/canvas";

/** Red of the Turkish flag (Türk Bayrağı Tüzüğü), as used by official digital artwork. */
export const TURKISH_FLAG_RED = "#e30a17";

/**
 * Proportions from the Turkish Flag Law (Türk Bayrağı Kanunu, 2893) as fractions of the flag's
 * height G. The 1/30 G hoist sleeve (gömlek) only exists on cloth flags, so images leave it out.
 */
export const TURKISH_FLAG_PROPORTIONS = {
  /** M: length of the flag. */
  length: 1.5,
  /** A: hoist to the centre of the crescent's outer circle. */
  outerCircleCenter: 1 / 2,
  /** B: diameter of the crescent's outer circle. */
  outerCircleDiameter: 1 / 2,
  /** C: distance between the centres of the outer and inner circles. */
  circleCenterOffset: 1 / 16,
  /** D: diameter of the crescent's inner circle. */
  innerCircleDiameter: 2 / 5,
  /** E: inner circle to the circle around the star, both measured at their hoist-side edges. */
  innerCircleToStarCircle: 1 / 3,
  /** F: diameter of the circle around the star. */
  starCircleDiameter: 1 / 4,
} as const;

/** Inner to outer radius of a regular five-pointed star. */
const STAR_INNER_RATIO = Math.cos((2 * Math.PI) / 5) / Math.cos(Math.PI / 5);

/** Crescent and star centres, as fractions of G from the top-left corner. */
export const turkishFlagGeometry = () => {
  const p = TURKISH_FLAG_PROPORTIONS;
  const outerX = p.outerCircleCenter;
  const innerX = outerX + p.circleCenterOffset;
  const starLeft = innerX - p.innerCircleDiameter / 2 + p.innerCircleToStarCircle;
  return {
    outer: { x: outerX, y: 0.5, radius: p.outerCircleDiameter / 2 },
    inner: { x: innerX, y: 0.5, radius: p.innerCircleDiameter / 2 },
    star: { x: starLeft + p.starCircleDiameter / 2, y: 0.5, radius: p.starCircleDiameter / 2 },
  };
};

/** Flat Turkish flag `height` tall, top-left corner at (x, y), hoist on the left. */
export const drawTurkishFlag = (context: SKRSContext2D, x: number, y: number, height: number) => {
  const g = height;
  const { outer, inner, star } = turkishFlagGeometry();
  context.save();
  context.translate(x, y);
  context.fillStyle = TURKISH_FLAG_RED;
  context.fillRect(0, 0, TURKISH_FLAG_PROPORTIONS.length * g, g);

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(outer.x * g, outer.y * g, outer.radius * g, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = TURKISH_FLAG_RED;
  context.beginPath();
  context.arc(inner.x * g, inner.y * g, inner.radius * g, 0, Math.PI * 2);
  context.fill();

  // One point aims at the hoist, straight back at the crescent.
  context.fillStyle = "#ffffff";
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = Math.PI + (point * Math.PI) / 5;
    const radius = star.radius * g * (point % 2 === 0 ? 1 : STAR_INNER_RATIO);
    const px = star.x * g + Math.cos(angle) * radius;
    const py = star.y * g + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.restore();
};

/** Flag with a soft shadow and a hairline edge so the red holds up on dark and red backgrounds. */
export const drawFramedTurkishFlag = (
  context: SKRSContext2D,
  x: number,
  y: number,
  height: number,
  unit: number,
) => {
  const width = TURKISH_FLAG_PROPORTIONS.length * height;
  context.save();
  context.shadowColor = "#00000080";
  context.shadowBlur = 6 * unit;
  context.shadowOffsetY = 1.5 * unit;
  context.fillStyle = TURKISH_FLAG_RED;
  context.fillRect(x, y, width, height);
  context.restore();
  drawTurkishFlag(context, x, y, height);
  context.save();
  context.strokeStyle = "#ffffff40";
  context.lineWidth = unit;
  context.strokeRect(x + unit / 2, y + unit / 2, width - unit, height - unit);
  context.restore();
};
