using FeatureService.Api.Models.Entities;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FeatureService.Api.Services;

public interface IHuggingFaceService
{
    Task<AiChatResult> ChatAsync(string userMessage, List<ChatMessage> history);
    Task<bool> IsAvailableAsync();
}

public class HuggingFaceService : IHuggingFaceService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HuggingFaceService> _logger;
    private readonly string _apiKey;
    private readonly string _modelId;

    public HuggingFaceService(HttpClient httpClient, IConfiguration configuration, ILogger<HuggingFaceService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        _apiKey = configuration["HuggingFace:ApiKey"] ?? throw new InvalidOperationException("HuggingFace API key not configured");
        _modelId = configuration["HuggingFace:ModelId"] ?? "meta-llama/Llama-3.3-70B-Instruct"; // Default to Llama 3.3 70B
    }

    public async Task<AiChatResult> ChatAsync(string userMessage, List<ChatMessage> history)
    {
        try
        {
            var messages = new List<object>();

            // Add system message
            messages.Add(new { role = "system", content = "You are a helpful AI assistant. Respond in the same language as the user. Be concise and helpful." });

            // Add conversation history
            foreach (var msg in history.TakeLast(10)) // Limit context
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }

            // Add current user message
            messages.Add(new { role = "user", content = userMessage });

            var requestBody = new
            {
                model = _modelId,
                messages = messages,
                max_tokens = 2048,
                temperature = 0.7,
                stream = false
            };

            var request = new HttpRequestMessage(HttpMethod.Post, $"https://api-inference.huggingface.co/models/{_modelId}/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<HuggingFaceChatResponse>(responseContent);

            if (result?.Choices == null || result.Choices.Count == 0)
            {
                throw new Exception("No response from HuggingFace API");
            }

            var assistantMessage = result.Choices[0].Message.Content;
            var inputTokens = result.Usage?.PromptTokens ?? EstimateTokens(string.Join(" ", messages.Select(m => ((dynamic)m).content)));
            var outputTokens = result.Usage?.CompletionTokens ?? EstimateTokens(assistantMessage);

            return new AiChatResult(assistantMessage, inputTokens, outputTokens);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HuggingFace API error");
            throw new Exception("Failed to get response from AI service. Please try again later.");
        }
    }

    public async Task<bool> IsAvailableAsync()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"https://api-inference.huggingface.co/models/{_modelId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            
            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static int EstimateTokens(string text)
    {
        // Rough estimate: 1 token per 4 characters
        return (int)Math.Ceiling(text.Length / 4.0);
    }
}

// Response models for HuggingFace API
public class HuggingFaceChatResponse
{
    [JsonPropertyName("choices")]
    public List<HuggingFaceChoice>? Choices { get; set; }

    [JsonPropertyName("usage")]
    public HuggingFaceUsage? Usage { get; set; }
}

public class HuggingFaceChoice
{
    [JsonPropertyName("message")]
    public HuggingFaceMessage Message { get; set; } = new();
}

public class HuggingFaceMessage
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
}

public class HuggingFaceUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }
}

// Shared result type for AI services
public record AiChatResult(string Response, int InputTokens, int OutputTokens);
