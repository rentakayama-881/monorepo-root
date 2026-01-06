using FeatureService.Api.Models.Entities;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FeatureService.Api.Services;

public interface IExternalLlmService
{
    Task<AiChatResult> ChatAsync(string model, string userMessage, List<ChatMessage> history);
    Task<bool> IsAvailableAsync();
    Task<List<LlmModelDto>> GetAvailableModelsAsync();
}

public class ExternalLlmService : IExternalLlmService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ExternalLlmService> _logger;
    private readonly string _n8nWebhookUrl;
    private readonly string _apiToken;

    public ExternalLlmService(HttpClient httpClient, IConfiguration configuration, ILogger<ExternalLlmService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
        
        // n8n webhook URL from your external provider
        _n8nWebhookUrl = configuration["ExternalLlm:N8nWebhookUrl"] ?? throw new InvalidOperationException("External LLM n8n webhook URL not configured");
        _apiToken = configuration["ExternalLlm:ApiToken"] ?? throw new InvalidOperationException("External LLM API token not configured");
    }

    public async Task<AiChatResult> ChatAsync(string model, string userMessage, List<ChatMessage> history)
    {
        try
        {
            // Validate model
            var modelInfo = ExternalLlmModels.GetById(model);
            if (modelInfo == null)
            {
                throw new ArgumentException($"Invalid model: {model}");
            }

            var messages = new List<object>();

            // Add system message
            messages.Add(new { role = "system", content = "You are a helpful AI assistant. Respond in the same language as the user. Be concise and helpful." });

            // Add conversation history
            foreach (var msg in history.TakeLast(10))
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }

            // Add current user message
            messages.Add(new { role = "user", content = userMessage });

            // Request body for n8n webhook
            var requestBody = new
            {
                model = model,
                messages = messages,
                max_tokens = 2048,
                temperature = 0.7,
                // Additional metadata for n8n workflow
                metadata = new
                {
                    source = "alephdraad",
                    timestamp = DateTime.UtcNow.ToString("O")
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, _n8nWebhookUrl);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiToken);
            request.Headers.Add("X-API-Key", _apiToken);
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<ExternalLlmResponse>(responseContent);

            if (result == null || string.IsNullOrEmpty(result.Content))
            {
                throw new Exception("No response from external LLM service");
            }

            var inputTokens = result.InputTokens > 0 ? result.InputTokens : EstimateTokens(string.Join(" ", messages.Select(m => ((dynamic)m).content)));
            var outputTokens = result.OutputTokens > 0 ? result.OutputTokens : EstimateTokens(result.Content);

            return new AiChatResult(result.Content, inputTokens, outputTokens);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "External LLM API error for model {Model}", model);
            throw new Exception("Failed to get response from AI service. Please try again later.");
        }
    }

    public async Task<bool> IsAvailableAsync()
    {
        try
        {
            // Health check endpoint (if provider supports it)
            var healthUrl = _n8nWebhookUrl.Replace("/webhook/", "/webhook-health/");
            var response = await _httpClient.GetAsync(healthUrl);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            // Assume available if health check not supported
            return true;
        }
    }

    public Task<List<LlmModelDto>> GetAvailableModelsAsync()
    {
        var models = ExternalLlmModels.All.Select(m => new LlmModelDto(
            m.Id,
            m.Name,
            m.Description,
            m.InputTokenCost,
            m.OutputTokenCost
        )).ToList();

        return Task.FromResult(models);
    }

    private static int EstimateTokens(string text)
    {
        // Rough estimate: 1 token per 4 characters
        return (int)Math.Ceiling(text.Length / 4.0);
    }
}

// Response model from external LLM (via n8n)
public class ExternalLlmResponse
{
    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("input_tokens")]
    public int InputTokens { get; set; }

    [JsonPropertyName("output_tokens")]
    public int OutputTokens { get; set; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; set; }
}
