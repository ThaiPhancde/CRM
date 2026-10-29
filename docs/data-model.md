# Mô hình dữ liệu

Cập nhật: 28/10/2026 (Phase 1). Nguồn: HLD §4; bản thiết kế mục 5.

**As-built (Phase 1, migration `20261028092621_init_org`):** `Workspace`, `User` (`isCompanyAdmin`), `Membership` (`roles Role[]`, `teamId`), `Team`, `Brand`, `Market` (`paymentMode PREPAID|COD`), `Store` (`platform` chuỗi, nhiều-nhiều với `Market`), `FxRate` (`Decimal(18,8)`, chỉ thêm), `AuditLog`, `IdempotencyKey`. **Phase 2 (migration `phase2_connectors_orders`):** `Setting`, `Connection`, `SyncRun`, `SyncCheckpoint`, `SourceEvent`, `Product`, `Variant`, `SourceProductMapping`, `Order`, `OrderItem`, `SourceOrderLink` (thêm `orderNumberNorm`, `refs`), `OrderLinkReview`, `MergeLog`, `Payment`, `Refund`, `Shipment`, `DeliveryEvent`. `Order` giữ ảnh chụp khách (`customerName/Phone/Email/SourceId`) — Phase 3 gắn `Customer`. Chưa có: `Return` (dùng `OrderItem.qtyReturned` + `returnStatus`), `Settlement` (Phase 10). **Khác bản đích:** không có bảng `Role` (D-34). **Phase 3 (migration `phase3_customer360`, `phase3_customer_stats`):** `Customer` (thêm `orderCount`, `deliveredOrders`, `valueBase12m`, `statsAt`, `mergedIntoId`), `CustomerIdentity` (unique theo kết nối + mã khách nguồn), `Address`, `ContactPreference` (chỉ thêm), `CustomerReview`; `Order.customerId`. `MergeLog` dùng chung cho đơn và khách (`entity`). **D-44 (migration `base_currency_vnd`):** đổi `rateToUsd→rateToBase`, `netUsd→netBase`, `valueUsd12m→valueBase12m`, tiền quy đổi chung là VND. **Phase 4 (migration `phase4_leads_tasks`, `event_not_owner`):** `Lead` (giai đoạn MOI…MAT_LIEN_LAC, `ownerId`/`teamId`, hạn phản hồi đầu, `idempotencyKey`), `Assignment` (chỉ thêm), `Activity` (CALL/MESSAGE/MEETING/NOTE/SYSTEM, chiều IN/OUT), `Task` (`idempotencyKey`, `remindedAt`), `Script`, `Outbox` (SIMULATED/PENDING/SENT/FAILED), `Notification`; `SourceEvent.outcome` thêm `NOT_OWNER`. Bất biến có test: lead mở luôn có người hoặc nằm ở hàng chờ có báo; gửi lại cùng khóa không tạo lead/việc/tương tác trùng; gộp khách mang theo lead/việc/tương tác và tách lại trả về. **Chịu tải (migration `scale_indexes`, `order_email_trgm`, D-48):** index cho mọi khóa ngoại trên bảng lớn + trigram (`pg_trgm`) cho tìm kiếm; `Lead.lastActivityAt`, `Lead.overdueNotifiedAt` (D-49). Các nhóm còn lại (A2–A5) là bản đích, chưa có trong schema.

Quy ước: mọi bảng nghiệp vụ có `id`, `workspaceId`, `createdAt`, `updatedAt`, `createdById`. Bản ghi nguồn thêm `connectionId`, `sourcePlatform`, `sourceStoreId`, `sourceRecordId`, `sourceUpdatedAt`, `ingestedAt`, `rawPayloadRef`. Tiền: `amount Decimal(18,4)`, `currency`, `fxRate`, `fxDate`, `reportingAmount` (tiền quy đổi chung VND, D-44; trong schema là `netBase`/`valueBase12m`, tỷ giá `FxRate.rateToBase`).

## A1. Tổ chức và danh mục

```mermaid
erDiagram
    Workspace ||--o{ Brand : has
    Workspace ||--o{ Market : has
    Workspace ||--o{ Team : has
    Workspace ||--o{ Membership : has
    Workspace ||--o{ FxRate : has
    Brand ||--o{ Store : has
    Store ||--o{ Connection : has
    Store }o--o{ Market : sells_in
    User ||--o{ Membership : has
    Role ||--o{ Membership : grants
    Team ||--o{ Membership : groups

    Workspace { string id PK  string code  string name  bool isActive }
    Brand { string id PK  string workspaceId FK  string code  string name }
    Store { string id PK  string brandId FK  string platform "mã adapter đăng ký: pancake, shopify, website… (D-28)"  string externalId  bool isActive }
    Market { string id PK  string workspaceId FK  string code "US|DE|FR|AE|SA|KW"  string currency  enum paymentMode "PREPAID|COD"  string timezone  string locale }
    Connection { string id PK  string storeId FK  enum platform  bytes configEncrypted  int pollIntervalMin  enum status  datetime lastSyncAt }
    User { string id PK  string email  string name  bool isGroupAdmin  bool isActive }
    Membership { string id PK  string workspaceId FK  string userId FK  string roleId FK  string teamId FK  bool isActive }
    Role { string id PK  string workspaceId FK  string code  string[] permissions }
    Team { string id PK  string workspaceId FK  string code  string name }
    FxRate { string id PK  string workspaceId FK  string currency  decimal rateToBase  date validFrom }
```

## A2. Khách và danh tính

```mermaid
erDiagram
    Customer ||--o{ CustomerIdentity : has
    Customer ||--o{ Address : has
    Customer ||--o{ ContactPreference : has
    Customer ||--o{ MergeLog : survivor
    Customer ||--o{ Order : places
    Customer ||--o{ Lead : has
    Customer ||--o{ Ticket : has
    Customer ||--o{ Activity : has

    Customer { string id PK  string workspaceId FK  string displayName  string primaryPhoneE164  string primaryEmail  string locale  string marketId FK  datetime firstOrderAt  datetime lastOrderAt  json tags }
    CustomerIdentity { string id PK  string customerId FK  enum platform  string connectionId FK  string sourceCustomerId  string phoneE164  string emailNormalized  bool emailVerified  datetime sourceUpdatedAt }
    Address { string id PK  string customerId FK  enum kind "SHIPPING|BILLING"  json raw  json normalized  string countryCode  bool isDefault }
    ContactPreference { string id PK  string customerId FK  enum channel "EMAIL|SMS|PHONE|MESSENGER|WHATSAPP"  enum purpose "MARKETING|SERVICE"  string brandId FK  bool optIn  datetime changedAt  string source }
    MergeLog { string id PK  string workspaceId FK  enum entity "CUSTOMER|ORDER"  string survivorId  string mergedId  json evidence  string mergedById  datetime unmergedAt  string unmergedById }
```

## A3. Đơn, sản phẩm, tiền, giao hàng

```mermaid
erDiagram
    Order ||--o{ OrderItem : has
    Order ||--o{ SourceOrderLink : linked_from
    Order ||--o{ Payment : has
    Order ||--o{ Refund : has
    Order ||--o{ Shipment : has
    Order ||--o{ Return : has
    Shipment ||--o{ DeliveryEvent : has
    Shipment ||--o| Settlement : settled_by
    Product ||--o{ Variant : has
    Variant ||--o{ SourceProductMapping : mapped
    Variant ||--o{ OrderItem : sold_as
    OrderLinkReview }o--|| Order : candidate_a
    OrderLinkReview }o--|| Order : candidate_b

    Order { string id PK  string workspaceId FK  string storeId FK  string marketId FK  string customerId FK  string orderNumber  enum status "BOOKED|CONFIRMED|CANCELLED"  enum paymentStatus "PENDING|PAID|PARTIAL|REFUNDED|COD_PENDING|COD_COLLECTED"  enum fulfillmentStatus "UNFULFILLED|PARTIAL|DELIVERED|FAILED|RETURNED"  enum returnStatus "NONE|REQUESTED|PARTIAL|FULL"  decimal grossAmount  decimal discount  decimal shippingFee  decimal netAmount  string currency  decimal fxRate  decimal reportingAmount  datetime bookedAt  datetime confirmedAt  datetime deliveredAt  datetime remittedAt }
    OrderItem { string id PK  string orderId FK  string variantId FK  string sourceSku  int qty  int qtyDelivered  int qtyReturned  decimal unitPrice  decimal lineAmount }
    SourceOrderLink { string id PK  string orderId FK  string connectionId FK  enum platform  string sourceRecordId  string sourceStatusRaw  datetime sourceUpdatedAt  bool isPrimary }
    OrderLinkReview { string id PK  string workspaceId FK  string orderAId FK  string orderBId FK  json reasons  enum status "PENDING|LINKED|REJECTED"  string decidedById }
    Payment { string id PK  string orderId FK  enum method "CARD|PAYPAL|COD|BANK"  decimal amount  string currency  enum status  datetime paidAt  string sourceRef }
    Refund { string id PK  string orderId FK  decimal amount  string currency  enum reason  datetime refundedAt }
    Shipment { string id PK  string orderId FK  string carrier  string trackingNo  enum status  enum failureReason  decimal codAmount  datetime deliveredAt  datetime collectedAt }
    DeliveryEvent { string id PK  string shipmentId FK  enum type "PICKED|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|FAILED|RETURNED|COD_COLLECTED"  string reasonCode  datetime occurredAt  json raw }
    Settlement { string id PK  string workspaceId FK  string carrier  date periodFrom  date periodTo  decimal amount  string currency  datetime remittedAt }
    Return { string id PK  string orderId FK  enum reason  int qty  enum status  datetime receivedAt }
    Product { string id PK  string workspaceId FK  string brandId FK  string code  string name  string category }
    Variant { string id PK  string productId FK  string sku  json attributes  decimal costPrice  string costCurrency }
    SourceProductMapping { string id PK  string variantId FK  string connectionId FK  string sourceSku  string sourceProductId }
```

## A4. Sales, dịch vụ, tri thức

```mermaid
erDiagram
    Lead ||--o{ Assignment : has
    Lead ||--o{ Activity : has
    Lead ||--o{ Task : has
    Ticket ||--o{ TicketEvent : has
    Ticket ||--o{ Task : has
    Ticket }o--|| SlaPolicy : governed_by
    Order ||--o{ Ticket : about

    Lead { string id PK  string workspaceId FK  string customerId FK  string brandId FK  string marketId FK  enum source  string[] productInterest  decimal declaredBudget  enum stage "MOI|DANG_TU_VAN|CHO_QUYET_DINH|DA_MUA|TU_CHOI|MAT_LIEN_LAC"  string lostReason  datetime nextActionAt  string ownerId FK  string teamId FK  datetime firstResponseDueAt  datetime firstRespondedAt }
    Assignment { string id PK  string leadId FK  string fromUserId  string toUserId  string reason  datetime assignedAt }
    Activity { string id PK  string workspaceId FK  string customerId FK  string leadId FK  string ticketId FK  enum type "CALL|MESSAGE|MEETING|NOTE|EMAIL"  enum outcome  int durationSec  text content  string language  datetime occurredAt  string userId FK }
    Task { string id PK  string workspaceId FK  enum type  string title  datetime dueAt  enum status "OPEN|DONE|CANCELLED"  string ownerId FK  string customerId FK  string leadId FK  string orderId FK  string ticketId FK  string idempotencyKey }
    Ticket { string id PK  string workspaceId FK  string customerId FK  string orderId FK  enum category "GIAO_CHAM|LOI_HANG|DOI_TRA|BAO_HANH|KHAC"  enum severity "THAP|TRUNG|CAO|KHAN"  enum status "OPEN|IN_PROGRESS|WAITING|RESOLVED|CLOSED"  string ownerId FK  string slaPolicyId FK  datetime firstResponseDueAt  datetime resolveDueAt  datetime firstRespondedAt  datetime resolvedAt  bool highValueFlag }
    TicketEvent { string id PK  string ticketId FK  enum type  text content  bool internal  string userId FK  datetime occurredAt }
    SlaPolicy { string id PK  string workspaceId FK  string brandId FK  enum severity  int firstResponseHours  int resolveHours }
    KnowledgeArticle { string id PK  string workspaceId FK  string brandId FK  string marketId FK  string language  string slug  string title  text bodyMd  int version  enum status "DRAFT|PUBLISHED|ARCHIVED"  string publishedById }
```

## A5. Chỉ số, điểm, marketing, AI, kỹ thuật

```mermaid
erDiagram
    Customer ||--o{ CustomerMetric : has
    Customer ||--o{ Score : has
    ScoreVersion ||--o{ Score : computed_with
    Segment ||--o{ Journey : triggers
    Journey ||--o{ JourneyRun : has
    Customer ||--o{ JourneyRun : in
    Campaign ||--o{ Touchpoint : has
    Customer ||--o{ Touchpoint : has
    Customer ||--o{ ContactCap : has
    AgentRun ||--o{ ToolCall : has
    AgentRun ||--o{ Suggestion : has
    Suggestion ||--o| Approval : needs
    Connection ||--o{ SyncRun : has
    SyncRun ||--o{ SourceEvent : has

    MetricDefinition { string code PK  string nameVi  string nameEn  text definition  text formula  string timing  string source  string owner  json dimensions  text pitfalls }
    CustomerMetric { string id PK  string customerId FK  date periodStart  date periodEnd  int orders  decimal rev01  decimal rev02  decimal rev03  decimal rev04  decimal refunds  int daysSinceLast  decimal avgCycleDays  decimal margin  datetime computedAt }
    ScoreVersion { string id PK  string workspaceId FK  enum kind "SALES_PRIORITY|RFM|TXN_RISK|SUPPORT_NEED"  int version  json weights  datetime activeFrom }
    Score { string id PK  string customerId FK  string leadId FK  string scoreVersionId FK  decimal value  string band  json reasons  json missingData  string suggestedAction  datetime computedAt }
    Prediction { string id PK  string customerId FK  enum target "BUY_7D|REBUY_60D|DELIVER_OK"  decimal probability  string modelVersion  datetime asOf  datetime evaluatedAt  bool actual }
    Experiment { string id PK  string workspaceId FK  string name  string journeyId FK  decimal holdoutPct  datetime startedAt  json results }
    Segment { string id PK  string workspaceId FK  string name  json conditions  datetime lastEvaluatedAt  int lastCount }
    Journey { string id PK  string workspaceId FK  string name  json trigger  json steps  json exitConditions  bool isActive }
    JourneyRun { string id PK  string journeyId FK  string customerId FK  int currentStep  enum status "ACTIVE|DONE|EXITED"  string exitReason  datetime nextAt }
    ContactCap { string id PK  string customerId FK  enum channel  string brandId FK  int windowDays  int maxContacts  int usedInWindow  datetime windowStart }
    Campaign { string id PK  string workspaceId FK  string brandId FK  string name  enum channel  decimal cost  string currency  date startDate  date endDate }
    Touchpoint { string id PK  string customerId FK  string campaignId FK  json utm  datetime occurredAt  string sourceRef }
    AgentRun { string id PK  string workspaceId FK  string userId FK  string feature  string model  text promptRedacted  text output  json evidence  int tokensIn  int tokensOut  decimal costUsd  enum status  datetime startedAt }
    ToolCall { string id PK  string agentRunId FK  string tool  json args  json result  enum status "OK|DENIED|ERROR|NEEDS_APPROVAL" }
    Suggestion { string id PK  string agentRunId FK  enum kind  json payload  enum status "PENDING|ACCEPTED|REJECTED" }
    Approval { string id PK  string suggestionId FK  string approverId FK  enum decision  text note  datetime decidedAt }
    AiCost { string id PK  string workspaceId FK  date day  string feature  string model  int tokens  decimal costUsd }
    SyncRun { string id PK  string connectionId FK  enum mode "BACKFILL|INCREMENTAL|REPLAY"  datetime startedAt  datetime finishedAt  int applied  int stale  int duplicate  int errors  json cursor }
    SourceEvent { string id PK  string syncRunId FK  string eventKey  enum recordType  string sourceRecordId  datetime sourceUpdatedAt  enum outcome "APPLIED|STALE|NOT_OWNER|DUPLICATE|ERROR"  string error  string rawPayloadRef }
    Outbox { string id PK  string workspaceId FK  enum channel  string to  string subject  text body  enum status "PENDING|SIMULATED|SENT|FAILED"  string idempotencyKey  string relatedEntity  string relatedId  datetime scheduledAt  datetime sentAt }
    AuditLog { string id PK  string workspaceId FK  string actorId  string entity  string entityId  string action  json before  json after  string reason  datetime at }
    IdempotencyKey { string id PK  string workspaceId FK  string scope  string key  string resultRef  datetime createdAt }
```

## B. Trạng thái

| Thực thể | Trạng thái | Chuyển hợp lệ |
|---|---|---|
| `Order.status` | BOOKED → CONFIRMED → (CANCELLED) | Không lùi; CANCELLED cuối |
| `Order.paymentStatus` | PENDING/COD_PENDING → PAID/COD_COLLECTED → PARTIAL/REFUNDED | Theo Payment/Refund |
| `Order.fulfillmentStatus` | UNFULFILLED → PARTIAL → DELIVERED; FAILED; RETURNED | Theo DeliveryEvent, tính từ dòng |
| `Lead.stage` | MOI → DANG_TU_VAN → CHO_QUYET_DINH → DA_MUA / TU_CHOI / MAT_LIEN_LAC | Mọi bước ghi Activity |
| `Ticket.status` | OPEN → IN_PROGRESS ↔ WAITING → RESOLVED → CLOSED | RESOLVED ghi `resolvedAt` |
| `JourneyRun.status` | ACTIVE → DONE / EXITED(reason) | Exit khi điều kiện ra |
| `Outbox.status` | PENDING → SIMULATED (demo) / SENT / FAILED | — |

## C. Bất biến phải kiểm thử

1. Unique (`workspaceId`, `connectionId`, `recordType`, `sourceRecordId`) trên `SourceOrderLink`, `CustomerIdentity`, `SourceProductMapping`.
2. Một `Order` có ≥ 1 `SourceOrderLink`, đúng một `isPrimary`.
3. `Order.reportingAmount = netAmount × fxRate` tại `fxDate`; không cộng khác tiền tệ.
4. `OrderItem.qtyDelivered + qtyReturned ≤ qty`; `fulfillmentStatus` suy từ dòng.
5. Ghi từ nguồn chỉ khi `sourceUpdatedAt` mới hơn bản lưu **và** nguồn là chủ nhóm trường theo `Setting.sourceOfTruth` (D-32); không phải chủ → `SourceEvent.outcome = NOT_OWNER`, không ghi.
6. `MergeLog` tách lại khôi phục `CustomerIdentity.customerId` và `Order.customerId`.
7. `Score` luôn có `scoreVersionId`; đổi trọng số tạo `ScoreVersion` mới, `Score` cũ giữ.
8. `ToolCall` ghi dữ liệu có `status = DENIED` khi thiếu quyền, không có side effect.
9. `Outbox.status = SIMULATED` khi `EXTERNAL_WRITES_ENABLED=false`; `idempotencyKey` unique.
10. Mọi truy vấn bảng có `workspaceId` không có ngữ cảnh → ném lỗi.
