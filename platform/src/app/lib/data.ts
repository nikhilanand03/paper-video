// Mock data for example papers
export const examplePapers = [
  {
    id: "attention",
    title: "Attention Is All You Need",
    authors: ["Vaswani et al."],
    url: "https://arxiv.org/abs/1706.03762",
    arxivId: "1706.03762",
  },
  {
    id: "bert",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    authors: ["Devlin et al."],
    url: "https://arxiv.org/abs/1810.04805",
    arxivId: "1810.04805",
  },
  {
    id: "alphafold",
    title: "Highly Accurate Protein Structure Prediction with AlphaFold",
    authors: ["Jumper et al."],
    url: "https://doi.org/10.1038/s41586-021-03819-2",
    arxivId: null,
  },
];

// All available template types (from template_registry.py)
export const templateTypes = [
  // Layout templates
  "title_card",
  "flashcard_list",
  "data_table",
  "big_number",
  "comparison_split",
  "quote_highlight",
  "section_header",
  "image_with_caption",
  "closing_card",
  // Chart templates
  "bar_chart",
  "grouped_bar_chart",
  "horizontal_bar_chart",
  "line_chart",
  "scatter_plot",
  "pie_donut_chart",
  "heatmap",
  "multi_metric_cards",
] as const;

export type TemplateType = (typeof templateTypes)[number];

// Template display info for the UI
export const templateInfo: Record<
  string,
  { label: string; icon: string; category: "layout" | "chart" }
> = {
  title_card: { label: "Title Card", icon: "📄", category: "layout" },
  flashcard_list: { label: "Flashcard List", icon: "📋", category: "layout" },
  data_table: { label: "Data Table", icon: "📊", category: "layout" },
  big_number: { label: "Big Number", icon: "🔢", category: "layout" },
  comparison_split: { label: "Comparison", icon: "⚖️", category: "layout" },
  quote_highlight: { label: "Quote", icon: "💬", category: "layout" },
  section_header: { label: "Section Header", icon: "📑", category: "layout" },
  image_with_caption: { label: "Figure", icon: "🖼️", category: "layout" },
  closing_card: { label: "Closing", icon: "🏁", category: "layout" },
  bar_chart: { label: "Bar Chart", icon: "📊", category: "chart" },
  grouped_bar_chart: {
    label: "Grouped Bar",
    icon: "📊",
    category: "chart",
  },
  horizontal_bar_chart: {
    label: "Horizontal Bar",
    icon: "📊",
    category: "chart",
  },
  line_chart: { label: "Line Chart", icon: "📈", category: "chart" },
  scatter_plot: { label: "Scatter Plot", icon: "⚬", category: "chart" },
  pie_donut_chart: { label: "Donut Chart", icon: "🍩", category: "chart" },
  heatmap: { label: "Heatmap", icon: "🗺️", category: "chart" },
  multi_metric_cards: {
    label: "Multi Metrics",
    icon: "📏",
    category: "chart",
  },
};

// Mock paper data with rich scenes matching planner_system.txt templates
export const mockPaperData: Record<string, any> = {
  attention: {
    title: "Attention Is All You Need",
    authors: [
      "Ashish Vaswani",
      "Noam Shazeer",
      "Niki Parmar",
      "Jakob Uszkoreit",
      "Llion Jones",
      "Aidan N. Gomez",
      "Łukasz Kaiser",
      "Illia Polosukhin",
    ],
    venue: "NeurIPS 2017",
    year: 2017,
    url: "https://arxiv.org/abs/1706.03762",
    abstract:
      "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
    sections: [
      {
        id: "intro",
        title: "Introduction",
        content:
          "Recurrent neural networks, long short-term memory and gated recurrent neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems such as language modeling and machine translation. Numerous efforts have since continued to push the boundaries of recurrent language models and encoder-decoder architectures.",
      },
      {
        id: "model",
        title: "Model Architecture",
        content:
          "Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations to a sequence of continuous representations. Given these representations, the decoder then generates an output sequence of symbols one element at a time. The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.",
      },
      {
        id: "attention-mechanism",
        title: "Scaled Dot-Product Attention",
        content:
          "An attention function can be described as mapping a query and a set of key-value pairs to an output. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key. We call our particular attention 'Scaled Dot-Product Attention'. The input consists of queries and keys of dimension dk, and values of dimension dv.",
      },
      {
        id: "results",
        title: "Results",
        content:
          "On the WMT 2014 English-to-German translation task, the big transformer model outperforms the best previously reported models (including ensembles) by more than 2.0 BLEU, establishing a new single-model state-of-the-art BLEU score of 28.4. On the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.0, outperforming all of the previously published single models, at less than 1/4 the training cost.",
      },
      {
        id: "conclusion",
        title: "Conclusion",
        content:
          "In this work, we presented the Transformer, the first sequence transduction model based entirely on attention, replacing the recurrent layers most commonly used in encoder-decoder architectures with multi-headed self-attention. The Transformer can be trained significantly faster than architectures based on recurrent or convolutional layers.",
      },
    ],
    scenes: [
      {
        id: 1,
        type: "title_card",
        label: "Title",
        duration: 8,
        narration:
          "Today we're looking at Attention Is All You Need, a landmark 2017 paper from Google Brain that introduced the Transformer architecture and fundamentally changed the field of natural language processing.",
        sectionId: "intro",
      },
      {
        id: 2,
        type: "quote_highlight",
        label: "Core Claim",
        duration: 10,
        narration:
          "The paper's central thesis is bold and simple: attention mechanisms alone, without recurrence or convolutions, are sufficient for state-of-the-art sequence transduction. This was a radical departure from the dominant paradigm.",
        sectionId: "intro",
      },
      {
        id: 3,
        type: "section_header",
        label: "Key Contributions",
        duration: 4,
        narration: "Let's look at the three key contributions of this paper.",
        sectionId: "intro",
      },
      {
        id: 4,
        type: "flashcard_list",
        label: "Contributions",
        duration: 15,
        narration:
          "The paper makes three major contributions. First, it introduces a novel architecture based entirely on attention mechanisms. Second, it eliminates the need for recurrence and convolutions. And third, it achieves state-of-the-art results while being significantly more parallelizable.",
        sectionId: "intro",
      },
      {
        id: 5,
        type: "section_header",
        label: "Architecture",
        duration: 4,
        narration: "Now let's dive into the Transformer architecture.",
        sectionId: "model",
      },
      {
        id: 6,
        type: "image_with_caption",
        label: "Architecture Diagram",
        duration: 15,
        narration:
          "The Transformer uses an encoder-decoder structure with stacked self-attention layers. The encoder maps input tokens to continuous representations, while the decoder generates output tokens one at a time, attending to the encoder's output.",
        sectionId: "model",
      },
      {
        id: 7,
        type: "comparison_split",
        label: "RNN vs Transformer",
        duration: 12,
        narration:
          "Compared to recurrent architectures, the Transformer offers key advantages. RNNs process tokens sequentially, creating bottlenecks. The Transformer processes all positions in parallel, dramatically reducing training time while improving quality.",
        sectionId: "model",
      },
      {
        id: 8,
        type: "section_header",
        label: "Attention Mechanism",
        duration: 4,
        narration: "The core innovation is scaled dot-product attention.",
        sectionId: "attention-mechanism",
      },
      {
        id: 9,
        type: "big_number",
        label: "Attention Heads",
        duration: 10,
        narration:
          "The model uses 8 parallel attention heads, allowing it to jointly attend to information from different representation subspaces at different positions. This multi-head approach is key to the model's expressiveness.",
        sectionId: "attention-mechanism",
      },
      {
        id: 10,
        type: "heatmap",
        label: "Attention Weights",
        duration: 12,
        narration:
          "Here we can see a visualization of attention weights. The model learns to attend to relevant positions — for example, when translating a word, it attends heavily to the corresponding source word and its syntactic context.",
        sectionId: "attention-mechanism",
      },
      {
        id: 11,
        type: "section_header",
        label: "Results",
        duration: 4,
        narration:
          "Let's look at the experimental results on machine translation.",
        sectionId: "results",
      },
      {
        id: 12,
        type: "data_table",
        label: "BLEU Scores",
        duration: 15,
        narration:
          "On the WMT 2014 English-to-German task, the Transformer achieves a BLEU score of 28.4, surpassing the best previous models by over 2 points. On English-to-French, it achieves 41.0 BLEU, outperforming all single models at a fraction of the training cost.",
        sectionId: "results",
      },
      {
        id: 13,
        type: "multi_metric_cards",
        label: "Key Metrics",
        duration: 10,
        narration:
          "To summarize the key results: 28.4 BLEU on English-to-German with a 3.2 point improvement, and 41.0 BLEU on English-to-French with a 0.5 point improvement — all at dramatically reduced training cost.",
        sectionId: "results",
      },
      {
        id: 14,
        type: "horizontal_bar_chart",
        label: "Training Cost",
        duration: 12,
        narration:
          "Perhaps the most striking result is the training efficiency. The Transformer requires less than one quarter of the compute of the best previous models, while achieving superior translation quality.",
        sectionId: "results",
      },
      {
        id: 15,
        type: "closing_card",
        label: "Takeaway",
        duration: 10,
        narration:
          "The Transformer proved that attention alone is sufficient for state-of-the-art sequence transduction, opening the door to models like BERT, GPT, and the entire modern NLP landscape.",
        sectionId: "conclusion",
      },
    ],
    videoUrl: "/mock-video.mp4",
    duration: 145,
  },
  bert: {
    title:
      "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: [
      "Jacob Devlin",
      "Ming-Wei Chang",
      "Kenton Lee",
      "Kristina Toutanova",
    ],
    venue: "NAACL 2019",
    year: 2019,
    url: "https://arxiv.org/abs/1810.04805",
    abstract:
      "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
    sections: [
      {
        id: "intro",
        title: "Introduction",
        content:
          "Language model pre-training has been shown to be effective for improving many natural language processing tasks. Pre-trained language representations can either be context-free or contextual. BERT uses a different pre-training objective: the 'masked language model' (MLM), inspired by the Cloze task.",
      },
      {
        id: "pretraining",
        title: "Pre-training Tasks",
        content:
          "BERT uses two unsupervised tasks for pre-training. Masked Language Model (MLM) randomly masks 15% of input tokens and predicts them. Next Sentence Prediction (NSP) determines if two sentences follow each other in the original text.",
      },
      {
        id: "results",
        title: "Results",
        content:
          "BERT obtains new state-of-the-art results on eleven natural language processing tasks, including pushing the GLUE score to 80.5%, MultiNLI accuracy to 86.7%, SQuAD v1.1 F1 to 93.2%, and SQuAD v2.0 F1 to 83.1%.",
      },
    ],
    scenes: [
      {
        id: 1,
        type: "title_card",
        label: "Title",
        duration: 8,
        narration:
          "BERT, which stands for Bidirectional Encoder Representations from Transformers, revolutionized NLP by introducing deep bidirectional pre-training for language understanding.",
        sectionId: "intro",
      },
      {
        id: 2,
        type: "quote_highlight",
        label: "Core Insight",
        duration: 10,
        narration:
          "The key insight of BERT is that bidirectional context matters. Unlike previous models that read text left-to-right or right-to-left, BERT conditions on both directions simultaneously in all layers.",
        sectionId: "intro",
      },
      {
        id: 3,
        type: "section_header",
        label: "Pre-training",
        duration: 4,
        narration:
          "BERT introduces two novel pre-training tasks that enable bidirectional learning.",
        sectionId: "pretraining",
      },
      {
        id: 4,
        type: "comparison_split",
        label: "MLM vs Traditional LM",
        duration: 12,
        narration:
          "Traditional language models predict the next word left-to-right, limiting context. BERT's Masked Language Model randomly masks 15% of tokens and predicts them using both left and right context, enabling true bidirectional representations.",
        sectionId: "pretraining",
      },
      {
        id: 5,
        type: "flashcard_list",
        label: "Pre-training Steps",
        duration: 12,
        narration:
          "BERT's pre-training involves three steps: First, tokenize text using WordPiece. Second, randomly mask 15% of tokens and predict them (MLM). Third, predict whether two sentences are consecutive (NSP).",
        sectionId: "pretraining",
      },
      {
        id: 6,
        type: "section_header",
        label: "Results",
        duration: 4,
        narration:
          "BERT achieves state-of-the-art results across a wide range of NLP benchmarks.",
        sectionId: "results",
      },
      {
        id: 7,
        type: "multi_metric_cards",
        label: "Benchmark Results",
        duration: 12,
        narration:
          "BERT sets new records across the board: 80.5% on GLUE, 93.2 F1 on SQuAD v1.1, and 86.7% accuracy on MultiNLI, demonstrating the power of bidirectional pre-training.",
        sectionId: "results",
      },
      {
        id: 8,
        type: "grouped_bar_chart",
        label: "Task Comparison",
        duration: 12,
        narration:
          "Compared to previous approaches like ELMo and GPT, BERT shows consistent improvements across all tasks. The bidirectional context proves especially valuable for tasks requiring understanding of full sentence meaning.",
        sectionId: "results",
      },
      {
        id: 9,
        type: "closing_card",
        label: "Takeaway",
        duration: 8,
        narration:
          "BERT demonstrated that bidirectional pre-training is a powerful approach for language understanding, spawning a family of models that continue to push NLP forward.",
        sectionId: "results",
      },
    ],
    videoUrl: "/mock-video.mp4",
    duration: 82,
  },
  alphafold: {
    title: "Highly Accurate Protein Structure Prediction with AlphaFold",
    authors: ["John Jumper", "Richard Evans", "Alexander Pritzel", "et al."],
    venue: "Nature",
    year: 2021,
    url: "https://doi.org/10.1038/s41586-021-03819-2",
    abstract:
      "Proteins are essential to life, and understanding their structure can facilitate a mechanistic understanding of their function. Through an enormous experimental effort, the structures of around 100,000 unique proteins have been determined, but this represents a small fraction of the billions of known protein sequences. Structural coverage is bottlenecked by the months to years of painstaking effort required to determine a single protein structure. Accurate computational approaches are needed to address this gap and to enable large-scale structural bioinformatics. AlphaFold produces highly accurate structures.",
    sections: [
      {
        id: "intro",
        title: "Introduction",
        content:
          "The three-dimensional structure of a protein is intimately connected with its biological function. AlphaFold is based on a neural network trained to predict the distance between pairs of residues and to predict the angles between chemical bonds.",
      },
      {
        id: "method",
        title: "Method",
        content:
          "AlphaFold uses a novel architecture called Evoformer that processes multiple sequence alignments (MSAs) and pair representations. The model iteratively refines its predictions through recycling, passing outputs back as inputs for further refinement.",
      },
      {
        id: "results",
        title: "Results",
        content:
          "In CASP14, AlphaFold achieved a median GDT score of 92.4, far exceeding the next best method at 76. This level of accuracy is considered comparable to experimental methods for many proteins.",
      },
    ],
    scenes: [
      {
        id: 1,
        type: "title_card",
        label: "Title",
        duration: 8,
        narration:
          "AlphaFold, developed by DeepMind, achieved a breakthrough in protein structure prediction, solving a 50-year grand challenge of biology.",
        sectionId: "intro",
      },
      {
        id: 2,
        type: "quote_highlight",
        label: "The Challenge",
        duration: 10,
        narration:
          "Understanding protein structure is essential for biology, but only about 100,000 structures had been determined experimentally — a tiny fraction of billions of known sequences. AlphaFold changed that equation entirely.",
        sectionId: "intro",
      },
      {
        id: 3,
        type: "section_header",
        label: "Method",
        duration: 4,
        narration: "Let's look at how AlphaFold works.",
        sectionId: "method",
      },
      {
        id: 4,
        type: "flashcard_list",
        label: "Architecture Components",
        duration: 12,
        narration:
          "AlphaFold has three key components: the Evoformer module that processes multiple sequence alignments, the structure module that predicts 3D coordinates, and a recycling mechanism that iteratively refines predictions.",
        sectionId: "method",
      },
      {
        id: 5,
        type: "image_with_caption",
        label: "Evoformer Architecture",
        duration: 15,
        narration:
          "The Evoformer processes MSA representations and pair representations in alternating attention blocks. This allows the model to reason about evolutionary relationships and spatial proximity simultaneously.",
        sectionId: "method",
      },
      {
        id: 6,
        type: "section_header",
        label: "Results",
        duration: 4,
        narration:
          "The results at CASP14 were nothing short of revolutionary.",
        sectionId: "results",
      },
      {
        id: 7,
        type: "big_number",
        label: "GDT Score",
        duration: 10,
        narration:
          "AlphaFold achieved a median GDT score of 92.4 in the CASP14 competition, far surpassing the next best method at 76. Scores above 90 are generally considered comparable to experimental accuracy.",
        sectionId: "results",
      },
      {
        id: 8,
        type: "bar_chart",
        label: "CASP14 Rankings",
        duration: 12,
        narration:
          "The gap between AlphaFold and the competition was unprecedented in CASP history. No previous method had come close to this level of accuracy, and the improvement was immediately recognized as a scientific breakthrough.",
        sectionId: "results",
      },
      {
        id: 9,
        type: "scatter_plot",
        label: "Accuracy vs Difficulty",
        duration: 12,
        narration:
          "Even on the most challenging protein targets, AlphaFold maintained high accuracy. This scatter plot shows that while other methods degraded rapidly on harder targets, AlphaFold remained robust.",
        sectionId: "results",
      },
      {
        id: 10,
        type: "closing_card",
        label: "Takeaway",
        duration: 8,
        narration:
          "AlphaFold solved a 50-year grand challenge, and DeepMind subsequently predicted structures for nearly all known proteins, transforming structural biology forever.",
        sectionId: "results",
      },
    ],
    videoUrl: "/mock-video.mp4",
    duration: 95,
  },
};

// Processing stages matching pipeline.py Status enum
export const processingStages = [
  {
    id: "extracting",
    label: "Extracting content",
    description: "Reading PDF, pulling text, tables, and figures",
  },
  {
    id: "planning",
    label: "Planning scenes",
    description: "AI selects templates and organizes the narrative",
  },
  {
    id: "rendering",
    label: "Rendering frames",
    description: "Generating visual slides and charts from templates",
  },
  {
    id: "synthesizing_tts",
    label: "Synthesizing narration",
    description: "Text-to-speech audio generation",
  },
  {
    id: "assembling",
    label: "Assembling video",
    description: "Stitching frames and audio into final MP4",
  },
];

// Helper to get or create a video ID
export function getOrCreateVideoId(paperId: string): string {
  const videos = JSON.parse(localStorage.getItem("videos") || "{}");

  if (videos[paperId]) {
    return videos[paperId];
  }

  const videoId = generateId();
  videos[paperId] = videoId;
  localStorage.setItem("videos", JSON.stringify(videos));

  return videoId;
}

// Helper to save a completed video to library
export function saveVideoToLibrary(videoId: string, paperData: any) {
  const library = JSON.parse(localStorage.getItem("library") || "[]");

  const existingIndex = library.findIndex((v: any) => v.id === videoId);

  const videoEntry = {
    id: videoId,
    ...paperData,
    generatedAt: new Date().toISOString(),
    views: existingIndex >= 0 ? library[existingIndex].views : 0,
  };

  if (existingIndex >= 0) {
    library[existingIndex] = videoEntry;
  } else {
    library.unshift(videoEntry);
  }

  localStorage.setItem("library", JSON.stringify(library));
}

// Helper to get library
export function getLibrary() {
  return JSON.parse(localStorage.getItem("library") || "[]");
}

// Helper to get video by ID
export function getVideoById(videoId: string) {
  const library = getLibrary();
  return library.find((v: any) => v.id === videoId);
}

// Helper to increment view count
export function incrementViewCount(videoId: string) {
  const library = getLibrary();
  const video = library.find((v: any) => v.id === videoId);

  if (video) {
    video.views = (video.views || 0) + 1;
    localStorage.setItem("library", JSON.stringify(library));
  }
}

// Helper to get/set notes for a video
export function getNotes(videoId: string) {
  const notes = JSON.parse(localStorage.getItem(`notes_${videoId}`) || "[]");
  return notes;
}

export function saveNote(
  videoId: string,
  note: { timestamp: number; text: string }
) {
  const notes = getNotes(videoId);
  notes.push({
    id: generateId(),
    ...note,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(`notes_${videoId}`, JSON.stringify(notes));
}

export function deleteNote(videoId: string, noteId: string) {
  const notes = getNotes(videoId);
  const filtered = notes.filter((n: any) => n.id !== noteId);
  localStorage.setItem(`notes_${videoId}`, JSON.stringify(filtered));
}

// Simple ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
