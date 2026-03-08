conda activate holi-hack
python run_cli.py sample-pdfs/contextfocus.pdf
python run_cli.py sample-pdfs/contextfocus.pdf --frames-only

python run_cli.py sample-pdfs/contextfocus.pdf --till-extract
python run_cli.py sample-pdfs/contextfocus.pdf --till-plan
python run_cli.py sample-pdfs/contextfocus.pdf --till-render
python run_cli.py sample-pdfs/contextfocus.pdf --till-tts

### view templates

cd holi-hack/templates
npm run dev