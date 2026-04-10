import "./index.css";
import { Composition, staticFile } from "remotion";
import { MyComposition } from "./Composition";
import { TitleCard, TitleCardSchema } from "./presets/TitleCard";
import {
  ArticleHighlight,
  ArticleHighlightSchema,
} from "./presets/ArticleHighlight";
import { ImageSlide } from "./presets/ImageSlide";
import { BarChartScene, BarChartSchema } from "./presets/BarChartScene";
import { BigNumberScene } from "./presets/BigNumberScene";
import { BulletSlide, BulletSlideSchema } from "./presets/BulletSlide";
import {
  ClosingCardScene,
  ClosingCardSchema,
} from "./presets/ClosingCardScene";
import {
  ComparisonSplitScene,
  ComparisonSplitSchema,
} from "./presets/ComparisonSplitScene";
import {
  QuoteHighlightScene,
  QuoteHighlightSchema,
} from "./presets/QuoteHighlightScene";
import {
  SectionHeaderScene,
  SectionHeaderSchema,
} from "./presets/SectionHeaderScene";
import {
  FlashcardListScene,
  FlashcardListSchema,
} from "./presets/FlashcardListScene";
import {
  DataTableScene,
  DataTableSchema,
} from "./presets/DataTableScene";
import {
  MultiMetricCardsScene,
  MultiMetricCardsSchema,
} from "./presets/MultiMetricCardsScene";
import {
  DonutChartScene,
  DonutChartSchema,
} from "./presets/DonutChartScene";
import {
  LineChartScene,
  LineChartSchema,
} from "./presets/LineChartScene";
import {
  ScatterPlotScene,
  ScatterPlotSchema,
} from "./presets/ScatterPlotScene";
import {
  HeatmapScene,
  HeatmapSchema,
} from "./presets/HeatmapScene";
import {
  HorizontalBarChartScene,
  HorizontalBarChartSchema,
} from "./presets/HorizontalBarChartScene";
import {
  GroupedBarChartScene,
  GroupedBarChartSchema,
} from "./presets/GroupedBarChartScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        schema={TitleCardSchema}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Attention Is All You Need",
          authors: [
            { name: "Ashish Vaswani", affiliation: "Google Brain" },
            { name: "Noam Shazeer", affiliation: "Google Brain" },
            { name: "Niki Parmar", affiliation: "Google Research" },
            { name: "Jakob Uszkoreit", affiliation: "Google Research" },
          ],
          subtitle:
            "A new simple network architecture based solely on attention mechanisms",
          venue: "NeurIPS",
          year: "2017",
        }}
      />
      <Composition
        id="ArticleHighlight"
        component={ArticleHighlight}
        schema={ArticleHighlightSchema}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          imageSrc: staticFile("test-article.png"),
          imageWidth: 900,
          imageHeight: 500,
          highlights: [
            {
              phrase: "government shutdown",
              boundingBox: { left: 173, top: 124, width: 160, height: 17 },
            },
            {
              phrase: "funding lapses",
              boundingBox: { left: 61, top: 208, width: 103, height: 17 },
            },
            {
              phrase: "government shutdown",
              boundingBox: { left: 352, top: 356, width: 160, height: 17 },
            },
          ],
          highlightColor: "rgba(255, 230, 0, 0.55)",
        }}
      />
      <Composition
        id="ImageSlide"
        component={ImageSlide}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          imageSrc: "https://picsum.photos/1200/600",
          caption: "This is a sample caption describing the image.",
          title: "This is a sample title",
          figureLabel: "Figure 1",
        }}
      />
      <Composition
        id="BarChart"
        component={BarChartScene}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        schema={BarChartSchema}
        defaultProps={{
          title: "My Chart",
          data: [
            { label: "A", value: 30, color: "#e05c5c" },
            { label: "B", value: 60, color: "#f0c040" },
            { label: "C", value: 90, color: "#9b6bb5" },
          ],
        }}
      />
      <Composition
        id="BigNumberScene"
        component={BigNumberScene}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          label: "Total Revenue",
          value: "2.4M",
          unit: "USD",
          description: "Across all product lines in Q4 2024",
        }}
      />
      <Composition
        id="BulletSlide"
        component={BulletSlide}
        schema={BulletSlideSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Key Contributions of This Paper",
          items: [
            "Introduced a novel self-attention mechanism that scales linearly with sequence length",
            {
              text: "Achieved state-of-the-art results on three benchmark datasets",
            },
            "Reduced training time by 40% compared to previous transformer architectures",
            {
              text: "Open-sourced model weights and training code for reproducibility",
            },
            "Demonstrated strong zero-shot transfer to downstream tasks",
          ],
        }}
      />
      <Composition
        id="ClosingCard"
        component={ClosingCardScene}
        schema={ClosingCardSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Thank You for Watching",
          summary:
            "This video was generated from the original research paper using AI-powered scene planning and animation.",
          paperUrl: "https://arxiv.org/abs/1706.03762",
        }}
      />
      <Composition
        id="ComparisonSplit"
        component={ComparisonSplitScene}
        schema={ComparisonSplitSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          heading: "Transformer vs. RNN Architecture",
          left: {
            label: "Transformer",
            tone: "positive" as const,
            points: [
              "Fully parallelizable training",
              "Constant path length between positions",
              "Scales efficiently with hardware",
              "Learns long-range dependencies",
            ],
          },
          right: {
            label: "Recurrent (LSTM/GRU)",
            tone: "negative" as const,
            points: [
              "Sequential computation bottleneck",
              "Path length grows with distance",
              "Difficult to parallelize",
              "Gradient vanishing over long sequences",
            ],
          },
        }}
      />
      <Composition
        id="QuoteHighlight"
        component={QuoteHighlightScene}
        schema={QuoteHighlightSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          quote:
            "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.",
          highlightPhrase: "complex recurrent or convolutional neural networks",
          attribution: "Vaswani et al., 2017",
        }}
      />
      <Composition
        id="SectionHeader"
        component={SectionHeaderScene}
        schema={SectionHeaderSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          sectionNumber: 1,
          heading: "Introduction",
          tagline: "Setting the stage for what follows",
        }}
      />
      <Composition
        id="FlashcardList"
        component={FlashcardListScene}
        schema={FlashcardListSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Key Takeaways",
          items: [
            "Self-attention replaces recurrence entirely",
            "Multi-head attention captures different representation subspaces",
            "Positional encoding preserves sequence order information",
            "Layer normalization stabilizes training",
            "Achieves new SOTA on WMT translation benchmarks",
          ],
        }}
      />
      <Composition
        id="DataTable"
        component={DataTableScene}
        schema={DataTableSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Model Comparison",
          columns: ["Model", "BLEU", "Params (M)", "Training Cost"],
          rows: [
            ["Transformer (base)", "27.3", "65", "$12K"],
            ["Transformer (big)", "28.4", "213", "$48K"],
            ["LSTM Seq2Seq", "25.9", "380", "$96K"],
            ["ConvS2S", "26.4", "216", "$52K"],
          ],
          caption: "Results on WMT 2014 English-to-German translation task",
        }}
      />
      <Composition
        id="MultiMetricCards"
        component={MultiMetricCardsScene}
        schema={MultiMetricCardsSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Performance Metrics",
          metrics: [
            {
              label: "BLEU Score",
              value: "28.4",
              delta: "+2.1",
              direction: "up" as const,
            },
            { label: "Parameters", value: "213M" },
            {
              label: "Training Cost",
              value: "$48K",
              unit: "USD",
            },
          ],
        }}
      />
      <Composition
        id="DonutChart"
        component={DonutChartScene}
        schema={DonutChartSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Attention Distribution",
          labels: ["Self-Attention", "Cross-Attention", "Feed-Forward", "Other"],
          values: [40, 25, 25, 10],
          centerValue: "100%",
          centerLabel: "Total",
        }}
      />
      <Composition
        id="LineChart"
        component={LineChartScene}
        schema={LineChartSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Training Loss Over Time",
          labels: ["Epoch 1", "Epoch 2", "Epoch 3", "Epoch 4", "Epoch 5"],
          datasets: [
            { label: "Transformer", values: [4.2, 2.8, 1.9, 1.4, 1.1] },
            { label: "LSTM", values: [4.5, 3.5, 2.8, 2.3, 2.0] },
          ],
        }}
      />
      <Composition
        id="ScatterPlot"
        component={ScatterPlotScene}
        schema={ScatterPlotSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Model Size vs. Performance",
          groups: [
            {
              label: "Transformers",
              points: [
                { x: 65, y: 27.3, label: "Base" },
                { x: 213, y: 28.4, label: "Big" },
              ],
            },
            {
              label: "RNNs",
              points: [
                { x: 380, y: 25.9, label: "LSTM" },
                { x: 216, y: 26.4, label: "ConvS2S" },
              ],
            },
          ],
          xLabel: "Parameters (M)",
          yLabel: "BLEU Score",
        }}
      />
      <Composition
        id="Heatmap"
        component={HeatmapScene}
        schema={HeatmapSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Attention Weights",
          rowLabels: ["Layer 1", "Layer 2", "Layer 3", "Layer 4"],
          colLabels: ["Head 1", "Head 2", "Head 3", "Head 4", "Head 5"],
          matrix: [
            [0.9, 0.3, 0.5, 0.2, 0.7],
            [0.4, 0.8, 0.3, 0.6, 0.5],
            [0.2, 0.5, 0.9, 0.4, 0.3],
            [0.6, 0.4, 0.2, 0.8, 0.9],
          ],
        }}
      />
      <Composition
        id="HorizontalBarChart"
        component={HorizontalBarChartScene}
        schema={HorizontalBarChartSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Model Accuracy Comparison",
          labels: [
            "Transformer",
            "LSTM",
            "GRU",
            "ConvS2S",
            "Attention-RNN",
          ],
          values: [28.4, 25.9, 24.8, 26.4, 27.1],
          highlightLabel: "Transformer",
        }}
      />
      <Composition
        id="GroupedBarChart"
        component={GroupedBarChartScene}
        schema={GroupedBarChartSchema}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Multi-Task Results",
          labels: ["EN-DE", "EN-FR", "EN-ES"],
          datasets: [
            { label: "Transformer", values: [28.4, 41.0, 34.2] },
            { label: "LSTM", values: [25.9, 36.5, 30.1] },
          ],
        }}
      />
    </>
  );
};
