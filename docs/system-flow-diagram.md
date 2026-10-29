# Sơ đồ tổng hợp CRM LevelUp — toàn bộ phase

Nguồn: bản thiết kế mục 8, 10; HLD §5, §6, §8, §9. Trạng thái 28/10/2026: Phase 0; chưa có code. Khi làm xong phase nào, ghi "đã có code" vào tiêu đề sơ đồ đó.

## 1. Bản đồ phase

```mermaid
flowchart TD
    subgraph PLAN["Kế hoạch demo"]
        P0[P0 Audit + đặc tả]
        P1[P1 Nền tảng, quyền, UI shell]
        P2[P2 Kết nối + đơn chuẩn]
        P3[P3 Customer 360]
        P4[P4 Nhu cầu mua + sales]
        P5[P5 Dịch vụ + tri thức]
        P6[P6 Chỉ số + điểm + Warehouse]
        P7[P7 Journey + marketing]
        P8[P8 Trung tâm AI]
        P9[P9 Báo cáo + dashboard]
        P10[P10 Vận đơn + sản phẩm]
        P11[P11 Quản trị + rà soát UI + chạy thử]
    end
    subgraph REAL["Ngoài demo"]
        P12[P12 Khóa thật, BigQuery, SSO, deploy]
    end
    P0 --> P1 --> P2 --> P3
    P3 --> P4 & P5 & P6
    P6 --> P7 & P9
    P4 & P5 & P6 --> P8
    P2 --> P10
    P7 & P8 & P9 & P10 --> P11 -.-> P12
```

## 2. Luồng dữ liệu tổng thể

```mermaid
flowchart LR
    subgraph SRC["Nguồn"]
        PK[Pancake POS]
        SH[Shopify]
        CAR[Vận chuyển / COD]
    end
    subgraph ING["Nhập (P2)"]
        AD[Adapter<br/>replay hoặc thật]
        EV[(SourceEvent)]
        NM[Chuẩn hóa<br/>chống trùng, muộn]
    end
    subgraph CORE["Lõi"]
        OR[(Order + SourceOrderLink)]
        CU[(Customer 360)]
        LD[(Lead / Task / Ticket)]
    end
    subgraph AN["Phân tích (P6, P9)"]
        WH[(Warehouse<br/>Postgres → BigQuery)]
        SC[Score / Segment]
        RP[Báo cáo REV-01..04]
    end
    subgraph ACT["Hành động (P7, P8)"]
        JR[Journey]
        AI[Trợ lý AI]
        OB[(Outbox SIMULATED)]
    end
    PK & SH & CAR --> AD --> EV --> NM --> OR --> CU
    CU --> LD
    OR & CU --> WH --> SC --> JR --> OB
    WH --> RP
    CU & OR & LD --> AI --> LD
    AI --> OB
```

## 3. Đồng bộ và liên kết đơn hai nguồn (P2)

```mermaid
sequenceDiagram
    participant W as Worker sync
    participant A as Adapter (replay)
    participant N as normalize
    participant DB as PostgreSQL
    W->>A: incremental(since = checkpoint − 10 phút)
    A-->>W: danh sách đơn nguồn (có sourceUpdatedAt)
    loop mỗi bản ghi
        W->>N: upsertFromSource(record)
        N->>DB: tìm SourceOrderLink (connection, recordId)
        alt chưa có
            N->>N: áp linkRules của cặp nền tảng (mã tham chiếu chéo, D-28)
            alt có tham chiếu khớp Order đã có
                N->>DB: thêm SourceOrderLink vào Order đó (isPrimary=false)
            else nghi ngờ (trùng tiền + SĐT + ±30 phút, không mã)
                N->>DB: tạo Order mới + OrderLinkReview PENDING
            else
                N->>DB: tạo Order mới + SourceOrderLink primary
            end
            N->>DB: SourceEvent APPLIED
        else đã có
            alt nguồn không phải chủ nhóm trường (sourceOfTruth, D-32)
                N->>DB: SourceEvent NOT_OWNER (không ghi)
            else sourceUpdatedAt mới hơn
                N->>DB: cập nhật trạng thái theo bảng ánh xạ, giữ raw; SourceEvent APPLIED
            else
                N->>DB: SourceEvent STALE (không ghi)
            end
        end
    end
    W->>DB: SyncCheckpoint = max(sourceUpdatedAt)
```

## 4. Hợp nhất khách (P3)

```mermaid
flowchart TD
    I[Identity mới từ nguồn] --> P{Trùng SĐT E.164<br/>hoặc email xác minh<br/>hoặc mã khách nguồn?}
    P -->|Có, đúng 1 khách| G[Gắn identity vào khách<br/>MergeLog AUTO]
    P -->|Có, >1 khách| R[Hàng đợi xác minh<br/>tab Khách]
    P -->|Không| C[Tạo Customer mới]
    R -->|Người có customer.merge gộp| G2[Gộp: survivor giữ, merged ẩn<br/>MergeLog evidence]
    R -->|Từ chối| C
    G2 -.->|Tách lại| U[Khôi phục identity + đơn về khách cũ<br/>MergeLog.unmergedAt]
```

## 5. Lead → phân công → hàng đợi (P4)

```mermaid
flowchart LR
    S[Nguồn lead:<br/>inbox fixture, website, tay] --> L[Lead MOI]
    L --> R{Quy tắc phân công<br/>market + brand + tải}
    R --> O[Owner + firstResponseDueAt]
    O --> Q[/hang-doi của owner/]
    Q -->|Activity| T[DANG_TU_VAN → CHO_QUYET_DINH]
    T --> B[DA_MUA: khớp Order mới]
    T --> X[TU_CHOI / MAT_LIEN_LAC + lý do]
    O -.->|quá hạn| N[Nhắc owner + trưởng nhóm<br/>Outbox SIMULATED]
```

## 6. Ticket và SLA (P5)

```mermaid
stateDiagram-v2
    [*] --> OPEN: tạo (tay / từ vận đơn / AI đề xuất)
    OPEN --> IN_PROGRESS: nhận xử lý (firstRespondedAt)
    IN_PROGRESS --> WAITING: chờ khách / vận chuyển
    WAITING --> IN_PROGRESS: có phản hồi
    IN_PROGRESS --> RESOLVED: resolvedAt
    RESOLVED --> CLOSED: sau 3 ngày hoặc khách xác nhận
    RESOLVED --> IN_PROGRESS: mở lại
    note right of OPEN: SLA theo severity; quá hạn → cờ + nhắc; highValueFlag ưu tiên
```

## 7. Chỉ số và điểm (P6)

```mermaid
flowchart LR
    O[(Order, Payment,<br/>DeliveryEvent, Settlement)] --> M[Warehouse.refreshMetrics<br/>SQL chuẩn]
    M --> CM[(CustomerMetric<br/>REV-01..04, hoàn, chu kỳ)]
    CM --> S[Score job<br/>ScoreVersion đang hiệu lực]
    S --> SC[(Score: value, band,<br/>reasons, missingData, action)]
    SC --> UI[Thẻ 360 / cột bảng / phân khúc]
    SC -->|thiếu dữ liệu| ND["Chưa đủ dữ liệu"]
```

## 8. Journey mua lại (P7, HLD §8.5)

```mermaid
flowchart TD
    T[Trigger: vào phân khúc<br/>Gần chu kỳ mua lại] --> C1{Có đơn mới /<br/>từ chối / ticket mở?}
    C1 -->|Có| E1[EXITED + lý do]
    C1 -->|Không| C2{Quyền liên hệ<br/>+ ContactCap còn?}
    C2 -->|Không| E2[EXITED: cap/opt-out]
    C2 -->|Có| C3{Tồn khả dụng<br/>fixture?}
    C3 -->|Không| TK[Tạo task cho sales]
    C3 -->|Có| M[Soạn tin theo ngôn ngữ<br/>mẫu / LLM replay]
    M --> OB[(Outbox SIMULATED<br/>idempotencyKey run+step)]
    OB --> W[Chờ 3 ngày] --> C1
```

## 9. Tác vụ AI có kiểm soát (P8, HLD §8.4)

```mermaid
sequenceDiagram
    participant U as Người dùng
    participant AI as modules/ai
    participant L as LlmProvider (replay/Anthropic)
    participant S as Service nghiệp vụ (requirePerm)
    participant DB as DB
    U->>AI: "Tạo việc gọi lại khách Nguyễn A ngày mai"
    AI->>S: tim_khach("Nguyễn A") với quyền của U
    S-->>AI: 2 kết quả
    AI-->>U: Hỏi lại: khách nào? (không đoán)
    U->>AI: chọn #1
    AI->>L: completeWithTools(ngữ cảnh đã lọc PII ngoài quyền)
    L-->>AI: tool tao_nhiem_vu(args)
    AI->>S: tao_nhiem_vu(args, idempotencyKey)
    alt thiếu task.manage
        S-->>AI: DENIED → ToolCall DENIED
    else cần duyệt theo cấu hình
        S-->>AI: Suggestion PENDING → Approval
    else
        S->>DB: Task + AuditLog
    end
    AI->>DB: AgentRun (prompt lọc, token, cost, evidence)
    AI-->>U: Kết quả + bằng chứng
```

## 10. Báo cáo đa tiền tệ (P9)

```mermaid
flowchart LR
    F[Bộ lọc: workspace, brand, store,<br/>market, kỳ, tiền tệ báo cáo] --> Q[Warehouse.query<br/>+ scopeFor(user)]
    Q --> R[Kết quả: nguyên tệ,<br/>tỷ giá, VND quy đổi, mã chỉ số]
    Q --> FR[freshness: lần refresh]
    R & FR --> V[Bảng + biểu đồ + định nghĩa]
    V --> X[Xuất Excel]
```

## 11. COD bốn mốc (P10, từ điển LevelUp)

```mermaid
flowchart LR
    B[REV-01 Đặt<br/>bookedAt] --> C[REV-02 Xác nhận<br/>confirmedAt]
    C --> D[REV-03 Giao thành công<br/>DeliveryEvent DELIVERED]
    D --> K[CASH-01 Đã thu<br/>COD_COLLECTED]
    K --> R[REV-04 / CASH-02 Thực thu<br/>Settlement remittedAt]
    C -.-> X[FAILED / RETURNED<br/>lý do chuẩn hóa → ticket]
```

## 12. Bảo mật xuyên suốt

```mermaid
flowchart TD
    REQ[Request / Action / Tool / Query] --> U[requireUser]
    U --> T[bindTenant(workspace)]
    T --> P[requirePerm + scopeFor]
    P --> M[Che trường: tiền, PII]
    M --> S[Service → DB]
    S --> A[(AuditLog / AgentRun)]
    S --> O[(Outbox: SIMULATED khi<br/>EXTERNAL_WRITES_ENABLED=false)]
```
