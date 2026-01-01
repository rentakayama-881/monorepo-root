package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// XenditClient handles Xendit API interactions
type XenditClient struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// NewXenditClient creates a new Xendit client
func NewXenditClient() *XenditClient {
	apiKey := os.Getenv("XENDIT_API_KEY")
	baseURL := os.Getenv("XENDIT_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.xendit.co"
	}

	return &XenditClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsConfigured checks if Xendit is properly configured
func (c *XenditClient) IsConfigured() bool {
	return c.apiKey != ""
}

// CreateInvoiceRequest represents a request to create an invoice
type CreateInvoiceRequest struct {
	ExternalID         string        `json:"external_id"`
	Amount             int64         `json:"amount"`
	Description        string        `json:"description"`
	InvoiceDuration    int           `json:"invoice_duration"` // in seconds
	CustomerEmail      string        `json:"customer,omitempty"`
	CustomerName       string        `json:"customer_name,omitempty"`
	SuccessRedirectURL string        `json:"success_redirect_url,omitempty"`
	FailureRedirectURL string        `json:"failure_redirect_url,omitempty"`
	PaymentMethods     []string      `json:"payment_methods,omitempty"`
	Currency           string        `json:"currency"`
	Items              []InvoiceItem `json:"items,omitempty"`
	Fees               []InvoiceFee  `json:"fees,omitempty"`
}

type InvoiceItem struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
	Price    int64  `json:"price"`
}

type InvoiceFee struct {
	Type  string `json:"type"`
	Value int64  `json:"value"`
}

// CreateInvoiceResponse represents the response from creating an invoice
type CreateInvoiceResponse struct {
	ID                 string    `json:"id"`
	ExternalID         string    `json:"external_id"`
	UserID             string    `json:"user_id"`
	Status             string    `json:"status"`
	MerchantName       string    `json:"merchant_name"`
	Amount             int64     `json:"amount"`
	Description        string    `json:"description"`
	InvoiceURL         string    `json:"invoice_url"`
	ExpiryDate         time.Time `json:"expiry_date"`
	Currency           string    `json:"currency"`
	PaymentMethod      string    `json:"payment_method,omitempty"`
	PaymentChannel     string    `json:"payment_channel,omitempty"`
	PaymentDestination string    `json:"payment_destination,omitempty"`
	Created            time.Time `json:"created"`
	Updated            time.Time `json:"updated"`
}

// CreateInvoice creates a new invoice for deposit
func (c *XenditClient) CreateInvoice(req CreateInvoiceRequest) (*CreateInvoiceResponse, error) {
	if !c.IsConfigured() {
		return nil, errors.New("xendit is not configured")
	}

	if req.Currency == "" {
		req.Currency = "IDR"
	}

	if req.InvoiceDuration == 0 {
		req.InvoiceDuration = 86400 // 24 hours default
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/v2/invoices", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	httpReq.SetBasicAuth(c.apiKey, "")
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("xendit error: %s", string(respBody))
	}

	var result CreateInvoiceResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetInvoice gets an invoice by ID
func (c *XenditClient) GetInvoice(invoiceID string) (*CreateInvoiceResponse, error) {
	if !c.IsConfigured() {
		return nil, errors.New("xendit is not configured")
	}

	httpReq, err := http.NewRequest("GET", c.baseURL+"/v2/invoices/"+invoiceID, nil)
	if err != nil {
		return nil, err
	}

	httpReq.SetBasicAuth(c.apiKey, "")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("xendit error: %s", string(respBody))
	}

	var result CreateInvoiceResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// DisbursementRequest represents a request to create a disbursement
type DisbursementRequest struct {
	ExternalID        string `json:"external_id"`
	Amount            int64  `json:"amount"`
	BankCode          string `json:"bank_code"`
	AccountHolderName string `json:"account_holder_name"`
	AccountNumber     string `json:"account_number"`
	Description       string `json:"description"`
	EmailTo           string `json:"email_to,omitempty"`
}

// DisbursementResponse represents the response from creating a disbursement
type DisbursementResponse struct {
	ID                string    `json:"id"`
	ExternalID        string    `json:"external_id"`
	UserID            string    `json:"user_id"`
	Amount            int64     `json:"amount"`
	BankCode          string    `json:"bank_code"`
	AccountHolderName string    `json:"account_holder_name"`
	Status            string    `json:"status"`
	Description       string    `json:"description"`
	Created           time.Time `json:"created"`
	Updated           time.Time `json:"updated"`
	FailureCode       string    `json:"failure_code,omitempty"`
}

// CreateDisbursement creates a new disbursement for withdrawal
func (c *XenditClient) CreateDisbursement(req DisbursementRequest) (*DisbursementResponse, error) {
	if !c.IsConfigured() {
		return nil, errors.New("xendit is not configured")
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/disbursements", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	httpReq.SetBasicAuth(c.apiKey, "")
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("xendit error: %s", string(respBody))
	}

	var result DisbursementResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// GetDisbursement gets a disbursement by ID
func (c *XenditClient) GetDisbursement(disbursementID string) (*DisbursementResponse, error) {
	if !c.IsConfigured() {
		return nil, errors.New("xendit is not configured")
	}

	httpReq, err := http.NewRequest("GET", c.baseURL+"/disbursements/"+disbursementID, nil)
	if err != nil {
		return nil, err
	}

	httpReq.SetBasicAuth(c.apiKey, "")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("xendit error: %s", string(respBody))
	}

	var result DisbursementResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// InvoiceCallback represents the callback payload from Xendit for invoice payments
type InvoiceCallback struct {
	ID                 string    `json:"id"`
	ExternalID         string    `json:"external_id"`
	UserID             string    `json:"user_id"`
	Status             string    `json:"status"`
	Amount             int64     `json:"amount"`
	PaidAmount         int64     `json:"paid_amount"`
	PayerEmail         string    `json:"payer_email"`
	Description        string    `json:"description"`
	PaymentMethod      string    `json:"payment_method"`
	PaymentChannel     string    `json:"payment_channel"`
	PaymentDestination string    `json:"payment_destination"`
	PaidAt             time.Time `json:"paid_at"`
	Created            time.Time `json:"created"`
	Updated            time.Time `json:"updated"`
	Currency           string    `json:"currency"`
	BankCode           string    `json:"bank_code,omitempty"`
	RetailOutletName   string    `json:"retail_outlet_name,omitempty"`
	EwalletType        string    `json:"ewallet_type,omitempty"`
}

// DisbursementCallback represents the callback payload from Xendit for disbursements
type DisbursementCallback struct {
	ID                      string    `json:"id"`
	ExternalID              string    `json:"external_id"`
	UserID                  string    `json:"user_id"`
	Amount                  int64     `json:"amount"`
	BankCode                string    `json:"bank_code"`
	AccountHolderName       string    `json:"account_holder_name"`
	DisbursementDescription string    `json:"disbursement_description"`
	Status                  string    `json:"status"`
	FailureCode             string    `json:"failure_code,omitempty"`
	IsInstant               bool      `json:"is_instant"`
	Created                 time.Time `json:"created"`
	Updated                 time.Time `json:"updated"`
}

// AvailableBanks returns list of available banks for disbursement
func (c *XenditClient) GetAvailableBanks() ([]Bank, error) {
	if !c.IsConfigured() {
		return nil, errors.New("xendit is not configured")
	}

	httpReq, err := http.NewRequest("GET", c.baseURL+"/available_disbursements_banks", nil)
	if err != nil {
		return nil, err
	}

	httpReq.SetBasicAuth(c.apiKey, "")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("xendit error: %s", string(respBody))
	}

	var result []Bank
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, err
	}

	return result, nil
}

type Bank struct {
	Name            string `json:"name"`
	Code            string `json:"code"`
	CanDisburse     bool   `json:"can_disburse"`
	CanNameValidate bool   `json:"can_name_validate"`
}

// SupportedPaymentMethods returns list of supported payment methods
var SupportedPaymentMethods = []string{
	"QRIS",
	"OVO",
	"DANA",
	"SHOPEEPAY",
	"LINKAJA",
	"BCA",
	"BNI",
	"BRI",
	"MANDIRI",
	"PERMATA",
	"ALFAMART",
	"INDOMARET",
	"CREDIT_CARD",
}
