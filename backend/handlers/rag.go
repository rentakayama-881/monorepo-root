package handlers

import (
	"net/http"
        "encoding/json"
        "strings"
        "strconv"
        "os"
	"github.com/gin-gonic/gin"

	"backend-gin/database"
	"backend-gin/utils"
)

// ==== Types ====

type IndexChunkReq struct {
	ThreadID string `json:"thread_id"`
	Content  string `json:"content"`
}

type Hit struct {
	ThreadID string `json:"thread_id"`
	Content  string `json:"content"`
}

// POST /api/rag/index-long
// Body: { "thread_id":"t-001", "content_long":"...teks panjang..." }
type IndexLongReq struct {
	ThreadID    string `json:"thread_id"`
	ContentLong string `json:"content_long"`
}

func IndexLongHandler(c *gin.Context) {
	var req IndexLongReq
	if err := c.ShouldBindJSON(&req); err != nil || req.ThreadID == "" || req.ContentLong == "" {
		c.JSON(400, gin.H{"error": "thread_id dan content_long wajib diisi"})
		return
	}

	chunks := utils.SplitToChunks(req.ContentLong, 800) // ~800 char/chunk
	indexed := 0

	for _, chunk := range chunks {
		// embed dokumen
		vec, err := utils.EmbedForDocument(chunk)
		if err != nil {
			c.JSON(500, gin.H{"error": "embed gagal: " + err.Error(), "indexed": indexed})
			return
		}
		vecLit := utils.VectorLiteral(vec)

		// simpan
		sql := `
			INSERT INTO public.thread_chunks (id, thread_id, content, embedding)
			VALUES (gen_random_uuid()::text, $1, $2, $3::vector)
		`
		if err := database.DB.Exec(sql, req.ThreadID, chunk, vecLit).Error; err != nil {
			c.JSON(500, gin.H{"error": "insert gagal: " + err.Error(), "indexed": indexed})
			return
		}
		indexed++
	}

	c.JSON(200, gin.H{
		"thread_id": req.ThreadID,
		"chunks":    indexed,
	})
}
// ==== Handlers ====

/*
POST /api/rag/index-chunk
Body:
{
  "thread_id": "t-001",
  "content": "teks chunk yang mau diindex"
}
*/
func IndexChunkHandler(c *gin.Context) {
    // 0) Bind dan validasi input
    var req struct {
        ThreadID string `json:"thread_id"` // masih string agar kompatibel dengan frontend
        Content  string `json:"content"`
    }
    if err := c.ShouldBindJSON(&req); err != nil || req.ThreadID == "" || req.Content == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "thread_id dan content wajib diisi"})
        return
    }

    // 1) Parse thread_id ke BIGINT
    tid, err := strconv.ParseInt(req.ThreadID, 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "thread_id harus berupa angka (bigint)"})
        return
    }

    // 2) Cohere embedding (mode dokumen)
    vec, err := utils.EmbedForDocument(req.Content)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "embed gagal: " + err.Error()})
        return
    }
    vecLit := utils.VectorLiteral(vec)

    // 3) Metadata model
    model := os.Getenv("COHERE_MODEL")
    if model == "" {
        model = "embed-multilingual-v3.0"
    }

    // 4) Simpan ke Postgres
    //    Tidak perlu menyebut kolom `id` karena sudah default UUID
    sql := `
        INSERT INTO public.thread_chunks
            (thread_id, content, embedding, model_name, embedding_dim)
        VALUES
            ($1, $2, $3::vector, $4, $5)
    `
    if err := database.DB.Exec(sql,
        tid,                // thread_id bigint
        req.Content,        // konten chunk
        vecLit,             // embedding vektor
        model,              // nama model embedding
        len(vec),           // dimensi embedding
    ).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "insert gagal: " + err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "thread_id":     tid,
        "contentLen":    len(req.Content),
        "embedding_dim": len(vec),
        "model_name":    model,
    })
}

/*
GET /api/rag/ask?q=...
Return: daftar hits (retrieval + optional rerank)
*/
func AskHandler(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parameter q wajib diisi"})
		return
	}

	// 1) Embed query
	vec, err := utils.EmbedForQuery(q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "embed query gagal: " + err.Error()})
		return
	}
	vecLit := utils.VectorLiteral(vec)

	// 2) Ambil top-k dari Postgres (cosine)
	hits := make([]Hit, 0)
	sql := `
		SELECT thread_id, content
		FROM public.thread_chunks
		ORDER BY embedding <=> $1::vector
		LIMIT 5
	`
	if err := database.DB.Raw(sql, vecLit).Scan(&hits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query gagal: " + err.Error()})
		return
	}

	// 3) Rerank dengan Cohere (jika ada >1)
	if len(hits) > 1 {
		docs := make([]string, 0, len(hits))
		for _, h := range hits {
			docs = append(docs, h.Content)
		}
		if idxs, err := utils.CohereRerank(q, docs, len(docs)); err == nil && len(idxs) == len(docs) {
			reranked := make([]Hit, 0, len(hits))
			for _, i := range idxs {
				reranked = append(reranked, hits[i])
			}
			hits = reranked
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"query": q,
		"hits":  hits,
	})
}

/*
GET /api/rag/answer?q=...
Return: jawaban dari Cohere Chat berbasis konteks hasil retrieval
*/
func AnswerHandler(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parameter q wajib diisi"})
		return
	}

	// 1) Embed query
	vec, err := utils.EmbedForQuery(q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "embed query gagal: " + err.Error()})
		return
	}
	vecLit := utils.VectorLiteral(vec)

	// 2) Ambil top-k dari Postgres
	hits := make([]Hit, 0)
	sql := `
		SELECT thread_id, content
		FROM public.thread_chunks
		ORDER BY embedding <=> $1::vector
		LIMIT 5
	`
	if err := database.DB.Raw(sql, vecLit).Scan(&hits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query gagal: " + err.Error()})
		return
	}
	if len(hits) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"query":   q,
			"answer":  "(tidak ada konteks yang cocok)",
			"sources": []Hit{},
		})
		return
	}

	// 3) Rerank (opsional)
	if len(hits) > 1 {
		docs := make([]string, 0, len(hits))
		for _, h := range hits {
			docs = append(docs, h.Content)
		}
		if idxs, err := utils.CohereRerank(q, docs, len(docs)); err == nil && len(idxs) == len(docs) {
			reranked := make([]Hit, 0, len(hits))
			for _, i := range idxs {
				reranked = append(reranked, hits[i])
			}
			hits = reranked
		}
	}

	// 4) Siapkan konteks & prompt
	contexts := make([]string, 0, len(hits))
	for _, h := range hits {
		contexts = append(contexts, h.Content)
	}

        prompt := "ATURAN MENJAWAB (WAJIB DIIKUTI):\n" +
  "• Jawab HANYA dengan mengutip kalimat dari KONTEKS. Jangan menambah atau menafsirkan.\n" +
  "• Jika pertanyaan umum/pendek, buat ringkasan poin dari kalimat yang DIKUTIP, tetap tanpa interpretasi.\n" +
  "• Sertakan kutipan dengan tanda petik, pisahkan dengan bullet.\n" +
  "• Jika KONTEKS tidak memuat jawabannya, tulis: 'Tidak tahu.'\n\n" +
  "PERTANYAAN: " + q + "\n\n" +
  "KONTEKS:\n" + strings.Join(contexts, "\n---\n")

	// 5) Cohere Chat
	answer, err := utils.CohereAnswer("", prompt, contexts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cohere chat gagal: " + err.Error()})
		return
	}

	// 6) Balikan jawaban + sumber
	c.JSON(http.StatusOK, gin.H{
		"query":   q,
		"answer":  answer,
		"sources": hits,
	})
}

func IndexThreadByIDHandler(c *gin.Context) {
    // 0) Ambil dan validasi path param :id → int64
    idStr := c.Param("id")
    if idStr == "" {
        c.JSON(400, gin.H{"error": "id wajib diisi"})
        return
    }
    tid, err := strconv.ParseInt(idStr, 10, 64)
    if err != nil {
        c.JSON(400, gin.H{"error": "id harus berupa angka (bigint)"})
        return
    }

    // 1) Ambil kolom yang dibutuhkan dari threads
    type row struct {
        ID          int64           `json:"id"`
        Title       string          `json:"title"`
        Summary     *string         `json:"summary"`
        ContentJSON json.RawMessage `json:"content_json"`
    }
    var r row
    if err := database.DB.Raw(`
        SELECT id, title, summary, content_json
        FROM public.threads
        WHERE id = ?
        LIMIT 1
    `, tid).Scan(&r).Error; err != nil {
        c.JSON(500, gin.H{"error": "ambil thread gagal: " + err.Error()})
        return
    }
    if r.ID == 0 {
        c.JSON(404, gin.H{"error": "thread tidak ditemukan"})
        return
    }

    // 2) Gabungkan title + summary + flatten(content_json) → teks penuh
    sum := ""
    if r.Summary != nil {
        sum = *r.Summary
    }
    jsonText := utils.FlattenJSONText(r.ContentJSON)
    full := strings.TrimSpace(strings.Join([]string{r.Title, sum, jsonText}, "\n\n"))
    if full == "" {
        c.JSON(400, gin.H{"error": "thread tidak punya konten teks yang bisa diindex"})
        return
    }

    // 3) Pecah jadi chunk ~800 char
    chunks := utils.SplitToChunks(full, 800)
    if len(chunks) == 0 {
        c.JSON(400, gin.H{"error": "chunking gagal"})
        return
    }

    // 4) Metadata embedding (untuk auditing & re-embed)
    model := os.Getenv("COHERE_MODEL")
    if model == "" {
        model = "embed-multilingual-v3.0"
    }

    // 5) Loop: embed & insert
    //    Catatan: kolom `id` di thread_chunks sudah UUID default → kita sengaja TIDAK menyebutkan kolom `id` di INSERT.
    indexed := 0
    for idx, chunk := range chunks {
        vec, err := utils.EmbedForDocument(chunk)
        if err != nil {
            c.JSON(500, gin.H{"error": "embed gagal: " + err.Error(), "indexed": indexed})
            return
        }
        vecLit := utils.VectorLiteral(vec)

        if err := database.DB.Exec(`
            INSERT INTO public.thread_chunks
                (thread_id, content, embedding, chunk_index, model_name, embedding_dim)
            VALUES
                ($1,        $2,      $3::vector, $4,         $5,         $6)
        `, r.ID, chunk, vecLit, idx, model, len(vec)).Error; err != nil {
            c.JSON(500, gin.H{"error": "insert gagal: " + err.Error(), "indexed": indexed})
            return
        }
        indexed++
    }

    c.JSON(200, gin.H{
        "thread_id": r.ID,
        "chunks":    indexed,
    })
}
// GET /api/rag/debug-chunks/:thread_id?limit=10
// Menampilkan preview isi chunk untuk thread tertentu (buat inspeksi cepat).
func DebugChunksHandler(c *gin.Context) {
	tid := c.Param("thread_id")
	if tid == "" {
		c.JSON(400, gin.H{"error": "thread_id wajib diisi"})
		return
	}
	limit := c.DefaultQuery("limit", "10")

	type Row struct {
		Content string `json:"content"`
	}
	var rows []Row
	q := `
		SELECT LEFT(content, 160) AS content
		FROM public.thread_chunks
		WHERE thread_id = ?
		ORDER BY id
		LIMIT ` + limit
	if err := database.DB.Raw(q, tid).Scan(&rows).Error; err != nil {
		c.JSON(500, gin.H{"error": "query gagal: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"thread_id": tid,
		"count":     len(rows),
		"previews":  rows,
	})
}
