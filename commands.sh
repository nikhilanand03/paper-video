## to ssh into azure instance
cd scripts
./shell.sh

## to serve up remotion studio
cd remotion-presets
npm run dev

## remotion-based cli rendering
RENDER_MODE=remotion python run_cli.py sample-pdfs/contextfocus.pdf