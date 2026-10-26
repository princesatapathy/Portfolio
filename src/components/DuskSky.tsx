// sunset gradient, a few soft stars and a moon, drawn over the 3D canvas.
// Everything fades with opacity so switching theme is smooth.

type DuskSkyProps = {
  isDusk: boolean;
};

// [left %, top %, size px, opacity] - top 40% of the sky only
const STARS: [number, number, number, number][] = [
  [8, 6, 2, 0.9],
  [17, 16, 3, 0.7],
  [26, 8, 2, 0.8],
  [33, 22, 2, 0.6],
  [58, 5, 2, 0.8],
  [66, 14, 3, 0.7],
  [74, 24, 2, 0.6],
  [82, 7, 2, 0.9],
  [91, 18, 2, 0.7],
  [95, 9, 3, 0.8],
  [44, 11, 2, 0.6],
  [12, 28, 2, 0.5],
];

const FADE = "transition-opacity duration-700 ease-in-out";

const DuskSky = ({ isDusk }: DuskSkyProps) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden"
  >
    {/* indigo at the top, warm orange glow near the horizon */}
    <div
      className={`absolute inset-0 ${FADE} ${isDusk ? "opacity-100" : "opacity-0"}`}
      style={{
        background:
          "linear-gradient(to bottom, rgba(38, 20, 92, 0.62) 0%, rgba(120, 52, 130, 0.28) 38%, rgba(255, 128, 72, 0.0) 62%, rgba(255, 138, 80, 0.34) 100%)",
      }}
    />

    {/* stars */}
    <div className={`absolute inset-0 ${FADE} ${isDusk ? "opacity-100" : "opacity-0"}`}>
      {STARS.map(([left, top, size, opacity]) => (
        <span
          key={`star_${left}_${top}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            opacity,
            boxShadow: "0 0 6px 1px rgba(255, 255, 255, 0.55)",
          }}
        />
      ))}
    </div>

    {/* moon */}
    <div
      className={`absolute right-[12%] top-[17%] size-14 rounded-full sm:size-16 ${FADE} ${isDusk ? "opacity-100" : "opacity-0"}`}
      style={{
        background:
          "radial-gradient(circle at 35% 32%, #fffdf2 0%, #f1ead2 55%, #d9d0b4 100%)",
        boxShadow: "0 0 36px 8px rgba(255, 244, 214, 0.35)",
      }}
    />
  </div>
);

export default DuskSky;
