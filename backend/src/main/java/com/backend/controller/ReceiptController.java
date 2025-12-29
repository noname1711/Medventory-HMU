package com.backend.controller;

import com.backend.dto.CreateReceiptDTO;
import com.backend.dto.ReceiptFeedResponseDTO;
import com.backend.dto.ReceiptResponseDTO;
import com.backend.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/receipts")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ReceiptController {

    private final ReceiptService receiptService;

    @PostMapping("/create")
    public ResponseEntity<ReceiptResponseDTO> createReceipt(
            @RequestBody CreateReceiptDTO request,
            @RequestHeader("X-User-Id") Long creatorId) {
        try {
            ReceiptResponseDTO response = receiptService.createReceipt(request, creatorId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(ReceiptResponseDTO.error("Lỗi khi tạo phiếu nhập: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/detail")
    public ResponseEntity<ReceiptResponseDTO> getReceiptDetail(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId) {
        try {
            ReceiptResponseDTO response = receiptService.getReceiptDetail(id, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(ReceiptResponseDTO.error("Không thể tải phiếu nhập"));
        }
    }

    @GetMapping("/feed")
    public ResponseEntity<ReceiptFeedResponseDTO> feed(
            @RequestParam(value = "afterId", required = false) Long afterId,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestHeader("X-User-Id") Long userId) {
        try {
            return ResponseEntity.ok(receiptService.feedReceipts(afterId, limit, userId));
        } catch (Exception e) {
            return ResponseEntity.ok(ReceiptFeedResponseDTO.error("Không thể lấy feed: " + e.getMessage()));
        }
    }
}
