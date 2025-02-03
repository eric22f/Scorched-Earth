# Scorched Earth

Scorched Earth is a simple web-based two-player artillery game built with React and TypeScript. Inspired by the classic game, this project features randomly generated terrain, turn-based missile firing, crater effects on the terrain, and even blocky clouds floating in the sky.

## Creator (Open AI [o3-mini-high])

Most of the work for this project was developed with extensive assistance from ChatGPT by OpenAI using the o3-mini-high model with direction and some assistance from me.  99% of the code was AI-generated.  I only had to tweak or redirect ChatGPT to fix the problem.

This experiment shows just how good o3-mini-high is at writing code independently.  And let's say that it is very impressive.

## Features

- **Random Terrain Generation:**  
  The terrain is generated using cosine interpolation with random control points, creating smooth hills, dips, and even extreme slopes.

- **Dynamic Station Positioning:**  
  Stations are placed on top of the terrain by sampling the maximum terrain height over the station’s width plus a margin. This ensures that the stations remain above ground even on steep slopes, allowing for proper missile launches.

- **Turn-Based Gameplay:**  
  Players take turns to enter a firing angle (0–90°) and missile power (0–500). A coin toss spinner animation determines who goes first.

- **Missile Simulation & Crater Effects:**  
  Missiles follow a realistic trajectory under gravity. When a missile explodes, a crater is “punched” into the terrain using a radial effect.

- **Clouds in the Sky:**  
  Randomly generated blocky clouds add atmosphere to the game. Each cloud is made up of two rectangles—one broad and one tall (with the tall rectangle almost as wide as the wide one)—and their positions and sizes vary.

## Getting Started

### Prerequisites

- Node.js (version 14 or above)
- npm

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/scorched-earth.git
   cd scorched-earth

2. **Run the development server:**

   ```bash
   npm install
   npm run dev
