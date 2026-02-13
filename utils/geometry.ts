import { Point, Size } from '../types';

/**
 * Calculates the intersection point between a line (from center1 to center2)
 * and the bounding rectangle of the source node (center1, size1).
 */
export const getIntersection = (center1: Point, size1: Size, center2: Point): Point => {
  const dx = center2.x - center1.x;
  const dy = center2.y - center1.y;

  if (dx === 0 && dy === 0) return center1;

  const aspect = size1.width / size1.height;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let scale: number;

  if (absDx > aspect * absDy) {
    // Intersects left or right
    scale = (size1.width / 2) / absDx;
  } else {
    // Intersects top or bottom
    scale = (size1.height / 2) / absDy;
  }

  return {
    x: center1.x + dx * scale,
    y: center1.y + dy * scale,
  };
};

export const getCenter = (x: number, y: number, width: number, height: number): Point => {
  return { x: x + width / 2, y: y + height / 2 };
};
