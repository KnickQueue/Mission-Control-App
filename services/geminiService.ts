
import { GoogleGenAI, GenerateContentResponse, GroundingChunk } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;
  private readonly modelName = 'gemini-2.5-flash-preview-04-17';
  private readonly rateLimitMessage = "API Rate Limit Exceeded: Too many requests. Please wait a few minutes before trying again or refresh less frequently.";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required to initialize GeminiService.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes("429") || errorMessage.includes("resource_exhausted") || errorMessage.includes("rate limit");
    }
    return false;
  }

  private async generateText(prompt: string, modelToUse: string = this.modelName): Promise<string> {
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: modelToUse,
        contents: prompt,
      });
      return response.text?.trim() ?? "";
    } catch (error) {
      console.error(`Error generating text with model ${modelToUse}:`, error);
      if (this.isRateLimitError(error)) {
        throw new Error(this.rateLimitMessage);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("permission denied")) {
        throw new Error(`Gemini API request failed: API key may be invalid or missing permissions. Details: ${errorMessage}`);
      }
      throw new Error(`Gemini API request failed: ${errorMessage}`);
    }
  }

  async fetchAdditionalServiceNames(
    existingServices: string[],
    count: number
  ): Promise<string[]> {
    const prompt = `List ${count} popular and critical online services or cloud platforms, different from ${existingServices.join(', ')}, that businesses and consumers rely on heavily. Provide just the names, comma-separated. Ensure they are distinct and commonly recognized. Examples: GitHub, Zoom, Slack.`;
    const responseText = await this.generateText(prompt);
    return responseText.split(',').map(name => name.trim()).filter(name => name.length > 0 && name.length < 50);
  }

  async fetchOutageDetails(serviceName: string): Promise<string> {
    const prompt = `The service "${serviceName}" is experiencing a simulated outage. Briefly describe a plausible, concise technical reason for this outage in one short sentence (max 15-20 words). For example, 'A critical database cluster is unresponsive' or 'Authentication services are failing due to a recent deployment misconfiguration.' Make the reason sound specific to what might affect a large online service like ${serviceName}.`;
    return this.generateText(prompt);
  }
  
  async fetchDownDetectorSummaryWithSearch(): Promise<{ summary: string; sources: GroundingChunk[] }> {
    const prompt = "Provide a brief, general summary of any major, widespread internet or popular service outages currently being reported globally, as if you were synthesizing information like Down Detector. Mention 2-3 fictional but realistic service disruptions if no major real ones are immediately apparent or focus on general trends. Use Google Search for current information if available. For example: 'Users are reporting widespread issues with social media platform 'ConnectSphere', primarily affecting login and content loading. Additionally, major ISP 'QuantumLink' seems to be experiencing DNS resolution problems in the Pacific Northwest region.'";
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const summaryText = response.text?.trim() ?? "";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources: GroundingChunk[] = groundingMetadata?.groundingChunks?.filter(
        (chunk): chunk is GroundingChunk => chunk.web !== undefined && chunk.web.uri !== undefined && chunk.web.title !== undefined
      ) || [];
      
      if (!summaryText && sources.length === 0) {
        return { summary: "No specific widespread outages identified by the scanner at this time. Systems appear stable.", sources: [] };
      }
      return { summary: summaryText || "Scanner data retrieved, but summary is currently unavailable.", sources };

    } catch (error) {
      console.error('Error fetching Down Detector summary with search:', error);
      if (this.isRateLimitError(error)) {
        return { summary: this.rateLimitMessage, sources: [] };
      }
      
      let errorMessageText = `Gemini API request failed for Down Detector summary. ${error instanceof Error ? error.message : String(error)}`;
      if (error instanceof Error && error.message.includes(" pilgrim.codevalidation.FAILED_PRECONDITION")) { 
         errorMessageText += " This might be due to tool use restrictions (e.g. Google Search) or configuration issues with the API call."
      } else if (error instanceof Error && (error.message.toLowerCase().includes("api key") || error.message.toLowerCase().includes("permission"))) {
         errorMessageText = "API key issue encountered while fetching global summary. Please check configuration."
      }
      return { summary: `Could not retrieve current outage reports: ${errorMessageText}`, sources: [] };
    }
  }
}
