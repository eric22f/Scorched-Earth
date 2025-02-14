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

// New interface for clouds.
interface Cloud {
  x: number;
  y: number;
  // The "wide" rectangle has width > height.
  wideRect: { width: number; height: number };
  // The "tall" rectangle has height > width.
  tallRect: { width: number; height: number };
  // Offsets for positioning the tall rectangle relative to the cloud’s base.
  offsetX: number;
  offsetY: number;
}

// --- Constants & Canvas Dimensions ---
const STATION_WIDTH = 30;
const STATION_HEIGHT = 15;
const GRAVITY = 100; // pixels per second²
const MISSILE_RADIUS = 5;
const EXPLOSION_RADIUS = 20;
const DT = 0.05; // simulation time step (in seconds)

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
  const [canvasWidth] = useState(window.innerWidth);
  const canvasHeight = 600; // fixed height
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // New state for clouds.
  const [clouds, setClouds] = useState<Cloud[]>([]);

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
  const [firing, setFiring] = useState<boolean>(false); // disables input while missile is in flight
  const [gameOver, setGameOver] = useState<boolean>(false);
  // New state to hide inputs during the coin toss
  const [tossing, setTossing] = useState<boolean>(false);

  // --- Update Tab Title ---
  useEffect(() => {
    if (gameOver) {
      document.title = "Scorched Earth: Game Over";
    } else {
      document.title = `Scorched Earth: Player ${currentPlayer === 0 ? "1" : "2"}`;
    }
  }, [currentPlayer, gameOver]);

  // --- New Game Setup with Coin Toss Animation ---
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
    // Start coin toss animation for a random duration between 2 and 5 seconds.
    setTossing(true);
    const coinTossTime = getRandomInt(2000, 5000);
    const spinnerSymbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIndex = 0;
    const tossInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerSymbols.length;
      setMessage(`Coin toss: ${spinnerSymbols[spinnerIndex]}`);
    }, 300);
    setTimeout(() => {
      clearInterval(tossInterval);
      setTossing(false);
      setMessage(
        firstPlayer === 0
          ? "Player 1 (Green Station): Your turn"
          : "Player 2 (Blue Station): Your turn"
      );
    }, coinTossTime);

    // Generate terrain and randomly position the stations.
    const newTerrain = generateTerrain(canvasWidth);
    // Update station positioning: sample the terrain over the station's width,
    // use the maximum value plus a margin to position the station.
    const stationMargin = 10;
    const leftX = getRandomInt(50, Math.floor(canvasWidth / 2) - 150);
    const rightX = getRandomInt(
      Math.floor(canvasWidth / 2) + 150,
      canvasWidth - 50 - STATION_WIDTH
    );
    const leftTerrainSection = newTerrain.slice(leftX, leftX + STATION_WIDTH);
    const leftTerrainY = Math.max(...leftTerrainSection);
    const leftY = leftTerrainY - STATION_HEIGHT - stationMargin;
    const rightTerrainSection = newTerrain.slice(rightX, rightX + STATION_WIDTH);
    const rightTerrainY = Math.max(...rightTerrainSection);
    const rightY = rightTerrainY - STATION_HEIGHT - stationMargin;
    const newLeftStation: Station = { x: leftX, y: leftY, width: STATION_WIDTH, height: STATION_HEIGHT };
    const newRightStation: Station = { x: rightX, y: rightY, width: STATION_WIDTH, height: STATION_HEIGHT };

    // Generate a random number of clouds (between 0 and 5).
    const numClouds = getRandomInt(0, 5);
    const newClouds: Cloud[] = [];
    for (let i = 0; i < numClouds; i++) {
      // Cloud position in the sky (y from 10 to 150, x from 0 to canvasWidth - 100 for margin).
      const cloudX = getRandomInt(0, canvasWidth - 100);
      const cloudY = getRandomInt(10, 150);
      // Wide rectangle: width between 80 and 150, height between 20 and 40.
      const wideWidth = getRandomInt(80, 150);
      const wideHeight = getRandomInt(20, 40);
      // Ensure wide rectangle: width > height.
      // Tall rectangle: between 5 and 20 less than wideWidth, height between 50 and 100.
      const tallWidth = wideWidth - getRandomInt(5, 20);
      const tallHeight = getRandomInt(50, 100);
      // Ensure tall rectangle: height > width.
      // Offsets for the tall rectangle relative to the cloud's base.
      const offsetX = getRandomInt(-10, 10);
      const offsetY = getRandomInt(-20, 0);
      newClouds.push({
        x: cloudX,
        y: cloudY,
        wideRect: { width: wideWidth, height: wideHeight },
        tallRect: { width: tallWidth, height: tallHeight },
        offsetX,
        offsetY,
      });
    }
    // Save clouds in state.
    setClouds(newClouds);

    setTerrain(newTerrain);
    setLeftStation(newLeftStation);
    setRightStation(newRightStation);
    drawGame(newTerrain, newLeftStation, newRightStation, null);
  };

  // Start a new game on mount and when canvasWidth changes.
  useEffect(() => {
    startNewGame();
  }, [canvasWidth]);

  // Redraw when player settings or turn changes (and not firing).
  useEffect(() => {
    if (!firing) {
      drawGame(terrain, leftStation, rightStation, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerSettings, currentPlayer]);

  // --- Utility Functions ---

  const generateTerrain = (width: number): number[] => {
    const numPoints = getRandomInt(2, 21);
    const controlPoints: { x: number; y: number }[] = [];
    const segmentLength = width / (numPoints - 1);
    for (let i = 0; i < numPoints; i++) {
      const x = i * segmentLength;
      let y: number;
      if (Math.random() < 0.3) {
        if (Math.random() < 0.5) {
          y = getRandomInt(50, TERRAIN_MIN_Y - 1);
        } else {
          y = getRandomInt(TERRAIN_MAX_Y + 1, canvasHeight);
        }
      } else {
        y = getRandomInt(TERRAIN_MIN_Y, TERRAIN_MAX_Y);
      }
      controlPoints.push({ x, y });
    }
    controlPoints[controlPoints.length - 1].x = width;
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
    for (let x = 0; x < width; x++) {
      if (terrainArr[x] === undefined) {
        terrainArr[x] = terrainArr[width - 1];
      }
    }
    return terrainArr;
  };

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

  // New helper function to draw clouds.
  const drawClouds = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    clouds.forEach((cloud) => {
      // Draw the wide rectangle.
      ctx.fillRect(cloud.x, cloud.y, cloud.wideRect.width, cloud.wideRect.height);
      // Draw the tall rectangle with its offset.
      const wDiff = cloud.wideRect.width * .35;
      const hDiff = cloud.wideRect.height * 1.15;
      ctx.fillRect(
        cloud.x + (wDiff / 2),
        cloud.y - (hDiff / 2),
        cloud.wideRect.width - wDiff,
        cloud.wideRect.height + hDiff
      );
    });
  };

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

    // Draw clouds.
    drawClouds(ctx);

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

    // Draw stations.
    ctx.fillStyle = "darkgreen"; // Player 1 (left)
    ctx.fillRect(left.x, left.y, left.width, left.height);
    ctx.fillStyle = "navy"; // Player 2 (right)
    ctx.fillRect(right.x, right.y, right.width, right.height);

    // Draw station labels.
    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Player 1", left.x + left.width / 2, left.y + left.height + 20);
    ctx.fillText("Player 2", right.x + right.width / 2, right.y + right.height + 20);

    // Draw cannons.
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

  // --- Missile Simulation (unchanged) ---
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

      // Allow missile to go above the top (so gravity can bring it down) but cancel if off left/right or below bottom.
      if (missileX < 0 || missileX >= canvasWidth || missileY >= canvasHeight) {
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

  // --- Explosion Animation and Crater Effect (unchanged, except as previously updated) ---
  const explosion = (
    explosionPos: Point,
    enemyStation: Station,
    directHit: boolean = false
  ) => {
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
        // Apply crater effect.
        const craterRadius = EXPLOSION_RADIUS; // Now crater radius equals the explosion radius.
        const newTerrain = [...terrain];
        const startX = Math.max(0, Math.floor(explosionPos.x - craterRadius));
        const endX = Math.min(newTerrain.length - 1, Math.ceil(explosionPos.x + craterRadius));
        for (let x = startX; x <= endX; x++) {
          const d = Math.abs(x - explosionPos.x);
          if (d < craterRadius) {
            const delta = craterRadius * (1 - d / craterRadius);
            newTerrain[x] = Math.min(newTerrain[x] + delta, canvasHeight);
          }
        }
        setTerrain(newTerrain);

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
          setTimeout(() => switchTurn(), 1000);
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

  // --- New Game Reset with Updated Coin Toss Spinner and Updated Station Positioning ---
  const resetGame = () => {
    setGameOver(false);
    setFiring(false);
    const firstPlayer = getRandomInt(0, 1);
    setCurrentPlayer(firstPlayer);
    setInputStep("angle");
    setPlayerSettings([
      { angle: "45", power: "250" },
      { angle: "45", power: "250" },
    ]);
    // Updated coin toss spinner animation:
    setMessage(`Coin toss: ⟳...`);
    setTossing(true);
    const coinTossTime = getRandomInt(2000, 5000);
    const spinnerSymbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIndex = 0;
    const tossInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerSymbols.length;
      setMessage(`Coin toss: ${spinnerSymbols[spinnerIndex]}`);
    }, 300);
    setTimeout(() => {
      clearInterval(tossInterval);
      setTossing(false);
      setMessage(
        firstPlayer === 0
          ? "Player 1 (Green Station): Your turn"
          : "Player 2 (Blue Station): Your turn"
      );
    }, coinTossTime);

    const newTerrain = generateTerrain(canvasWidth);
    const leftX = getRandomInt(50, Math.floor(canvasWidth / 2) - 150);
    const rightX = getRandomInt(
      Math.floor(canvasWidth / 2) + 150,
      canvasWidth - 50 - STATION_WIDTH
    );
    // Updated station positioning: sample the terrain over the station's width.
    const stationMargin = 10;
    const leftTerrainSection = newTerrain.slice(leftX, leftX + STATION_WIDTH);
    const leftTerrainY = Math.max(...leftTerrainSection);
    const leftY = leftTerrainY - STATION_HEIGHT - stationMargin;
    const rightTerrainSection = newTerrain.slice(rightX, rightX + STATION_WIDTH);
    const rightTerrainY = Math.max(...rightTerrainSection);
    const rightY = rightTerrainY - STATION_HEIGHT - stationMargin;
    const newLeftStation: Station = { x: leftX, y: leftY, width: STATION_WIDTH, height: STATION_HEIGHT };
    const newRightStation: Station = { x: rightX, y: rightY, width: STATION_WIDTH, height: STATION_HEIGHT };
    setTerrain(newTerrain);
    setLeftStation(newLeftStation);
    setRightStation(newRightStation);
    drawGame(newTerrain, newLeftStation, newRightStation, null);

    // Also regenerate clouds.
    const numClouds = getRandomInt(0, 5);
    const newClouds: Cloud[] = [];
    for (let i = 0; i < numClouds; i++) {
      const cloudX = getRandomInt(0, canvasWidth - 100);
      const cloudY = getRandomInt(10, 150);
      // Wide rectangle: width between 80 and 150, height between 20 and 40.
      const wideWidth = getRandomInt(80, 150);
      const wideHeight = getRandomInt(20, 40);
      // Ensure wide: width > height.
      // Tall rectangle: width between 20 and 40, height between 50 and 100.
      const tallWidth = getRandomInt(20, 40);
      const tallHeight = getRandomInt(50, 100);
      // Ensure tall: height > width.
      const offsetX = getRandomInt(-10, 10);
      const offsetY = getRandomInt(-20, 0);
      newClouds.push({
        x: cloudX,
        y: cloudY,
        wideRect: { width: wideWidth, height: wideHeight },
        tallRect: { width: tallWidth, height: tallHeight },
        offsetX,
        offsetY,
      });
    }
    setClouds(newClouds);
  };

  // --- Handling User Input & Auto-Focus ---
  const angleInputRef = useRef<HTMLInputElement>(null);
  const powerInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!tossing) {
      if (inputStep === "angle" && angleInputRef.current) {
        angleInputRef.current.focus();
      } else if (inputStep === "power" && powerInputRef.current) {
        powerInputRef.current.focus();
      }
    }
  }, [inputStep, tossing]);

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
    setMessage(`Player ${currentPlayer === 0 ? "1" : "2"} - Firing Angle: ${angle}°`);
    setInputStep("power");
  };

  const handlePowerSubmit = () => {
    const power = parseFloat(playerSettings[currentPlayer].power);
    if (isNaN(power) || power < 0 || power > 500) {
      setMessage("Invalid power. Please enter a value between 0 and 500.");
      return;
    }
    // Place missile at the cannon tip and show it briefly before launching.
    const rawAngle = parseFloat(playerSettings[currentPlayer].angle);
    const firingStation = currentPlayer === 0 ? leftStation : rightStation;
    const startPos = getCanonTip(firingStation, rawAngle);
    // Draw the missile at the tip.
    drawGame(terrain, leftStation, rightStation, startPos);
    setTimeout(() => {
      setFiring(true);
      setMessage(
        `Player ${currentPlayer === 0 ? "1" : "2"} firing at ${playerSettings[currentPlayer].angle}° with power ${playerSettings[currentPlayer].power}.`
      );
      const simAngleRad =
        currentPlayer === 0
          ? (rawAngle * Math.PI) / 180
          : ((180 - rawAngle) * Math.PI) / 180;
      const enemyStation = currentPlayer === 0 ? rightStation : leftStation;
      simulateMissile(startPos, simAngleRad, enemyStation, power);
    }, 500);
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
          {!firing && !gameOver && !tossing && (
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
