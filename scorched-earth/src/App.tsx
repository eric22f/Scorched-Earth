import React, { useState, useEffect, useRef, KeyboardEvent } from "react";

// --- Interfaces ---
interface Station {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// --- Constants & Canvas Dimensions ---
const STATION_WIDTH = 30;
const STATION_HEIGHT = 15;
const GRAVITY = 100; // pixels per second²
const MISSILE_RADIUS = 5;
const EXPLOSION_RADIUS = 20;
const DT = 0.05; // simulation time step in seconds

// Canon constants
const CANON_LENGTH = 30; // length of the canon barrel
const CANON_THICKNESS = 6; // thickness of the canon barrel

// For a canvas height of 600
const TERRAIN_MIN_Y = 300;
const TERRAIN_MAX_Y = 500;

// Input steps
type InputStep = "angle" | "power";

// Player settings are retained between turns.
interface PlayerSettings {
  angle: string;
  power: string;
}

const App: React.FC = () => {
  // Use the full browser width for the canvas.
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
  const canvasHeight = 600; // fixed height

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper: get a random integer between min and max (inclusive)
  const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // --- Terrain and Station Positions ---
  const [terrain, setTerrain] = useState<number[]>([]);
  const [leftStation, setLeftStation] = useState<Station>({
    x: 50,
    y: 0,
    width: STATION_WIDTH,
    height: STATION_HEIGHT,
  });
  const [rightStation, setRightStation] = useState<Station>({
    x: canvasWidth - 50 - STATION_WIDTH,
    y: 0,
    width: STATION_WIDTH,
    height: STATION_HEIGHT,
  });

  // --- Game Turn and Input State ---
  const [currentPlayer, setCurrentPlayer] = useState<number>(0); // 0: left, 1: right
  const [inputStep, setInputStep] = useState<InputStep>("angle");
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings[]>([
    { angle: "45", power: "250" },
    { angle: "45", power: "250" },
  ]);
  const [message, setMessage] = useState<string>("");
  const [firing, setFiring] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);

  // --- Update Tab Title ---
  useEffect(() => {
    if (gameOver) {
      document.title = "Scorched Earth: Game Over";
    } else {
      document.title = `Scorched Earth: Player ${currentPlayer === 0 ? "1" : "2"}`;
    }
  }, [currentPlayer, gameOver]);

  // --- New Game Setup ---
  const startNewGame = () => {
    setGameOver(false);
    setFiring(false);
    // Randomize first player
    const firstPlayer = getRandomInt(0, 1);
    setCurrentPlayer(firstPlayer);
    setInputStep("angle");
    setPlayerSettings([
      { angle: "45", power: "250" },
      { angle: "45", power: "250" },
    ]);
    setMessage(`Coin toss: Player ${firstPlayer === 0 ? "1" : "2"} goes first!`);
    setTimeout(() => {
      setMessage(
        firstPlayer === 0
          ? "Player 1 (Green Station): Your turn"
          : "Player 2 (Blue Station): Your turn"
      );
    }, 2000);

    // Generate terrain and randomly position stations.
    const newTerrain = generateTerrain(canvasWidth);
    // Randomize station x-positions:
    // Player 1: between 50 and (canvasWidth/2 - 150)
    // Player 2: between (canvasWidth/2 + 150) and (canvasWidth - 50 - STATION_WIDTH)
    const leftX = getRandomInt(50, Math.floor(canvasWidth / 2) - 150);
    const rightX = getRandomInt(Math.floor(canvasWidth / 2) + 150, canvasWidth - 50 - STATION_WIDTH);
    const leftY = newTerrain[leftX] - STATION_HEIGHT;
    const rightXCenter = rightX + STATION_WIDTH / 2;
    const rightY = newTerrain[Math.floor(rightXCenter)] - STATION_HEIGHT;
    const newLeftStation: Station = { x: leftX, y: leftY, width: STATION_WIDTH, height: STATION_HEIGHT };
    const newRightStation: Station = { x: rightX, y: rightY, width: STATION_WIDTH, height: STATION_HEIGHT };

    setTerrain(newTerrain);
    setLeftStation(newLeftStation);
    setRightStation(newRightStation);
    drawGame(newTerrain, newLeftStation, newRightStation, null);
  };

  // Start a new game on mount and when canvasWidth changes.
  useEffect(() => {
    startNewGame();
  }, [canvasWidth]);

  // Redraw when player settings or turn changes (if not firing).
  useEffect(() => {
    if (!firing) {
      drawGame(terrain, leftStation, rightStation, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerSettings, currentPlayer]);

  // --- Utility Functions ---

  // Generate terrain using control points and cosine interpolation.
  // We generate between 2 and 21 control points (representing 1 to 20 hills).
  // Each control point has a 30% chance to be extreme: either a deep dip (between 50 and TERRAIN_MIN_Y-1)
  // or a tall hill (between TERRAIN_MAX_Y+1 and canvasHeight).
  const generateTerrain = (width: number): number[] => {
    const numPoints = getRandomInt(2, 21); // 2 points = 1 hill, 21 points = 20 hills.
    const controlPoints: { x: number; y: number }[] = [];
    const segmentLength = width / (numPoints - 1);
    for (let i = 0; i < numPoints; i++) {
      const x = i * segmentLength;
      let y: number;
      if (Math.random() < 0.3) {
        // Extreme point: 50% chance for a deep dip, 50% chance for a tall hill.
        if (Math.random() < 0.5) {
          y = getRandomInt(50, TERRAIN_MIN_Y - 1); // deep dip
        } else {
          y = getRandomInt(TERRAIN_MAX_Y + 1, canvasHeight);
        }
      } else {
        // Normal hill.
        y = getRandomInt(TERRAIN_MIN_Y, TERRAIN_MAX_Y);
      }
      controlPoints.push({ x, y });
    }
    // Ensure the last control point is exactly at x = width.
    controlPoints[controlPoints.length - 1].x = width;

    // Interpolate between control points.
    const terrainArr = new Array(width);
    for (let i = 0; i < controlPoints.length - 1; i++) {
      const p0 = controlPoints[i];
      const p1 = controlPoints[i + 1];
      const startX = Math.floor(p0.x);
      const endX = Math.floor(p1.x);
      for (let x = startX; x < endX && x < width; x++) {
        const t = (x - p0.x) / (p1.x - p0.x);
        const t2 = (1 - Math.cos(t * Math.PI)) / 2;
        terrainArr[x] = p0.y * (1 - t2) + p1.y * t2;
      }
    }
    // Fill any undefined indices.
    for (let x = 0; x < width; x++) {
      if (terrainArr[x] === undefined) {
        terrainArr[x] = terrainArr[width - 1];
      }
    }
    return terrainArr;
  };

  // Get terrain height at x using linear interpolation.
  const getTerrainHeight = (terrainArr: number[], x: number): number => {
    if (x < 0 || x >= terrainArr.length - 1) {
      return canvasHeight;
    }
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = terrainArr[x0];
    const y1 = terrainArr[x1];
    const fraction = x - x0;
    return y0 + (y1 - y0) * fraction;
  };

  // Draw the canon for a station.
  const drawCanon = (ctx: CanvasRenderingContext2D, station: Station, angleDeg: number) => {
    const canonAngleDeg = station.x > canvasWidth / 2 ? 180 - angleDeg : angleDeg;
    const angleRad = (canonAngleDeg * Math.PI) / 180;
    const baseX = station.x + station.width / 2;
    const baseY = station.y;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(-angleRad);
    ctx.fillStyle = "gray";
    ctx.fillRect(0, -CANON_THICKNESS / 2, CANON_LENGTH, CANON_THICKNESS);
    ctx.restore();
  };

  // Compute the canon tip (muzzle) for a station.
  const getCanonTip = (station: Station, angleDeg: number): Point => {
    const canonAngleDeg = station.x > canvasWidth / 2 ? 180 - angleDeg : angleDeg;
    const angleRad = (canonAngleDeg * Math.PI) / 180;
    const baseX = station.x + station.width / 2;
    const baseY = station.y;
    return {
      x: baseX + CANON_LENGTH * Math.cos(angleRad),
      y: baseY - CANON_LENGTH * Math.sin(angleRad),
    };
  };

  // Draw the game state: sky, terrain, stations, canons, and (if applicable) missile.
  const drawGame = (
    terrainArr: number[],
    left: Station,
    right: Station,
    missilePos: Point | null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw sky.
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw terrain.
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight);
    for (let x = 0; x < terrainArr.length; x++) {
      ctx.lineTo(x, terrainArr[x]);
    }
    ctx.lineTo(canvasWidth, canvasHeight);
    ctx.closePath();
    ctx.fill();

    // Draw stations with colors.
    ctx.fillStyle = "darkgreen"; // Player 1 (left)
    ctx.fillRect(left.x, left.y, left.width, left.height);
    ctx.fillStyle = "navy"; // Player 2 (right)
    ctx.fillRect(right.x, right.y, right.width, right.height);

    // Draw station labels ("Player 1" / "Player 2"), centered below the stations.
    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Player 1", left.x + left.width / 2, left.y + left.height + 20);
    ctx.fillText("Player 2", right.x + right.width / 2, right.y + right.height + 20);

    // Draw canons.
    const leftAngle = parseFloat(playerSettings[0].angle);
    const rightAngle = parseFloat(playerSettings[1].angle);
    const validLeftAngle = !isNaN(leftAngle) ? leftAngle : 45;
    const validRightAngle = !isNaN(rightAngle) ? rightAngle : 45;
    drawCanon(ctx, left, validLeftAngle);
    drawCanon(ctx, right, validRightAngle);

    // Draw missile if in flight.
    if (missilePos) {
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(missilePos.x, missilePos.y, MISSILE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // --- Missile Simulation ---
  const simulateMissile = (
    startPos: Point,
    simAngleRad: number,
    enemyStation: Station,
    velocity: number
  ) => {
    let t = 0;
    let animationFrameId: number;

    const animate = () => {
      const missileX = startPos.x + velocity * Math.cos(simAngleRad) * t;
      const missileY = startPos.y - velocity * Math.sin(simAngleRad) * t + 0.5 * GRAVITY * t * t;
      const missilePos: Point = { x: missileX, y: missileY };

      drawGame(terrain, leftStation, rightStation, missilePos);

      if (missileX < 0 || missileX >= canvasWidth || missileY < 0 || missileY >= canvasHeight) {
        cancelAnimationFrame(animationFrameId);
        setFiring(false);
        setMessage("Missed! Switching turns...");
        setTimeout(() => {
          switchTurn();
        }, 1000);
        return;
      }

      if (missileY >= getTerrainHeight(terrain, missileX)) {
        explosion(missilePos, enemyStation);
        cancelAnimationFrame(animationFrameId);
        return;
      }

      if (
        missileX >= enemyStation.x &&
        missileX <= enemyStation.x + enemyStation.width &&
        missileY >= enemyStation.y &&
        missileY <= enemyStation.y + enemyStation.height
      ) {
        explosion(missilePos, enemyStation, true);
        cancelAnimationFrame(animationFrameId);
        return;
      }

      t += DT;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
  };

  // --- Explosion Animation ---
  const explosion = (explosionPos: Point, enemyStation: Station, directHit: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frames = 0;
    const maxFrames = 10;

    const explosionAnimation = () => {
      drawGame(terrain, leftStation, rightStation, null);
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(explosionPos.x, explosionPos.y, EXPLOSION_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      frames++;
      if (frames < maxFrames) {
        requestAnimationFrame(explosionAnimation);
      } else {
        const enemyCenter = {
          x: enemyStation.x + enemyStation.width / 2,
          y: enemyStation.y + enemyStation.height / 2,
        };
        const dx = explosionPos.x - enemyCenter.x;
        const dy = explosionPos.y - enemyCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (directHit || distance <= EXPLOSION_RADIUS) {
          setMessage(`Player ${currentPlayer === 0 ? "1" : "2"} wins!`);
          setGameOver(true);
        } else {
          setMessage("Missed! Switching turns...");
          setTimeout(() => {
            switchTurn();
          }, 1000);
        }
        setFiring(false);
      }
    };

    explosionAnimation();
  };

  // --- Turn Switching ---
  const switchTurn = () => {
    setCurrentPlayer((prev) => (prev === 0 ? 1 : 0));
    setInputStep("angle");
    setMessage(
      currentPlayer === 0
        ? "Player 2 (Blue Station): Your turn"
        : "Player 1 (Green Station): Your turn"
    );
    drawGame(terrain, leftStation, rightStation, null);
  };

  // --- New Game Reset ---
  const resetGame = () => {
    setGameOver(false);
    setFiring(false);
    // Randomize first player with a coin toss.
    const firstPlayer = getRandomInt(0, 1);
    setCurrentPlayer(firstPlayer);
    setInputStep("angle");
    setPlayerSettings([
      { angle: "45", power: "250" },
      { angle: "45", power: "250" },
    ]);
    setMessage(`Coin toss: Player ${firstPlayer === 0 ? "1" : "2"} goes first!`);
    setTimeout(() => {
      setMessage(
        firstPlayer === 0
          ? "Player 1 (Green Station): Your turn"
          : "Player 2 (Blue Station): Your turn"
      );
    }, 2000);
    const newTerrain = generateTerrain(canvasWidth);
    const leftX = getRandomInt(50, Math.floor(canvasWidth / 2) - 150);
    const rightX = getRandomInt(Math.floor(canvasWidth / 2) + 150, canvasWidth - 50 - STATION_WIDTH);
    const leftY = newTerrain[leftX] - STATION_HEIGHT;
    const rightXCenter = rightX + STATION_WIDTH / 2;
    const rightY = newTerrain[Math.floor(rightXCenter)] - STATION_HEIGHT;
    const newLeftStation: Station = { x: leftX, y: leftY, width: STATION_WIDTH, height: STATION_HEIGHT };
    const newRightStation: Station = { x: rightX, y: rightY, width: STATION_WIDTH, height: STATION_HEIGHT };
    setTerrain(newTerrain);
    setLeftStation(newLeftStation);
    setRightStation(newRightStation);
    drawGame(newTerrain, newLeftStation, newRightStation, null);
  };

  // --- Handling User Input & Auto-Focus ---
  const angleInputRef = useRef<HTMLInputElement>(null);
  const powerInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputStep === "angle" && angleInputRef.current) {
      angleInputRef.current.focus();
    } else if (inputStep === "power" && powerInputRef.current) {
      powerInputRef.current.focus();
    }
  }, [inputStep]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (inputStep === "angle") {
        handleAngleSubmit();
      } else {
        handlePowerSubmit();
      }
    }
  };

  const handleAngleSubmit = () => {
    const angle = parseFloat(playerSettings[currentPlayer].angle);
    if (isNaN(angle) || angle < 0 || angle > 90) {
      setMessage("Invalid angle. Please enter a value between 0 and 90.");
      return;
    }
    setMessage(`Angle entered: ${angle}°`);
    setInputStep("power");
  };

  const handlePowerSubmit = () => {
    const power = parseFloat(playerSettings[currentPlayer].power);
    if (isNaN(power) || power < 0 || power > 500) {
      setMessage("Invalid power. Please enter a value between 0 and 500.");
      return;
    }
    setFiring(true);
    setMessage(
      `Player ${currentPlayer === 0 ? "1" : "2"} firing at ${playerSettings[currentPlayer].angle}° with power ${playerSettings[currentPlayer].power}.`
    );
    const rawAngle = parseFloat(playerSettings[currentPlayer].angle);
    const simAngleRad =
      currentPlayer === 0
        ? (rawAngle * Math.PI) / 180
        : ((180 - rawAngle) * Math.PI) / 180;
    const firingStation = currentPlayer === 0 ? leftStation : rightStation;
    const enemyStation = currentPlayer === 0 ? rightStation : leftStation;
    const startPos = getCanonTip(firingStation, rawAngle);
    simulateMissile(startPos, simAngleRad, enemyStation, power);
  };

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAngle = e.target.value;
    setPlayerSettings((prev) =>
      prev.map((settings, idx) =>
        idx === currentPlayer ? { ...settings, angle: newAngle } : settings
      )
    );
  };

  const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPower = e.target.value;
    setPlayerSettings((prev) =>
      prev.map((settings, idx) =>
        idx === currentPlayer ? { ...settings, power: newPower } : settings
      )
    );
  };

  return (
    <div style={{ position: "relative", backgroundColor: "#f0f0f0", padding: "10px" }}>
      {/* Persistent New Game Button in Top Left */}
      <button
        onClick={resetGame}
        style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10 }}
      >
        New Game
      </button>
      <div style={{ textAlign: "center", paddingTop: "40px" }}>
        <h1 style={{ margin: "0" }}>Scorched Earth</h1>
        <div style={{ fontSize: "0.8em", marginBottom: "20px" }}>
          Brought to you by o3-mini-high
        </div>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid black", background: "#87CEEB", width: "100%" }}
        />
        <div style={{ marginTop: "10px" }}>
          <p>{message}</p>
          {!firing && !gameOver && (
            <div>
              {inputStep === "angle" ? (
                <label>
                  Firing Angle (0–90):{" "}
                  <input
                    ref={angleInputRef}
                    type="number"
                    value={playerSettings[currentPlayer].angle}
                    onChange={handleAngleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Angle"
                    min="0"
                    max="90"
                    step="0.1"
                  />
                </label>
              ) : (
                <label>
                  Missile Power (0–500):{" "}
                  <input
                    ref={powerInputRef}
                    type="number"
                    value={playerSettings[currentPlayer].power}
                    onChange={handlePowerChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Power"
                    min="0"
                    max="500"
                    step="1"
                  />
                </label>
              )}
              <button
                onClick={inputStep === "angle" ? handleAngleSubmit : handlePowerSubmit}
                style={{ marginLeft: "10px" }}
              >
                {inputStep === "angle" ? "Next" : "Fire!"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
