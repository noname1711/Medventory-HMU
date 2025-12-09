package com.backend.controller;

import com.backend.dto.ReceiptRequestDTO;
import com.backend.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/receipts")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ReceiptController {

    private final ReceiptService receiptService;

    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createReceipt(
            @RequestBody ReceiptRequestDTO request,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        Map<String, Object> result = receiptService.createReceipt(request, thuKhoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/my-receipts")
    public ResponseEntity<Map<String, Object>> getMyReceipts(@RequestHeader("X-User-Id") Long thuKhoId) {
        // Gọi service method (cần thêm method này vào ReceiptService)
        Map<String, Object> result = receiptService.getMyReceipts(thuKhoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getReceiptDetail(@PathVariable Long id) {
        // Gọi service method (cần thêm method này vào ReceiptService)
        Map<String, Object> result = receiptService.getReceiptDetail(id);
        return ResponseEntity.ok(result);
    }

    // Tìm kiếm vật tư khi tạo phiếu nhập
    @GetMapping("/materials/search")
    public ResponseEntity<Map<String, Object>> searchMaterialsForReceipt(
            @RequestParam(value = "keyword", required = false) String keyword) {

        Map<String, Object> response = receiptService.searchMaterialsForReceipt(keyword);
        return ResponseEntity.ok(response);
    }

    // Lấy chi tiết vật tư khi chọn từ autocomplete
    @GetMapping("/materials/{id}")
    public ResponseEntity<Map<String, Object>> getMaterialForReceipt(@PathVariable Long id) {
        Map<String, Object> response = receiptService.getMaterialDetailsForReceipt(id);
        return ResponseEntity.ok(response);
    }
}