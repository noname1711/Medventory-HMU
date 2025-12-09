package com.backend.controller;

import com.backend.dto.InventoryStockDTO;
import com.backend.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/stock/{materialId}")
    public ResponseEntity<InventoryStockDTO> getStockByMaterial(@PathVariable Long materialId) {
        InventoryStockDTO stock = inventoryService.getStockByMaterial(materialId);
        return ResponseEntity.ok(stock);
    }

    @GetMapping("/all-stock")
    public ResponseEntity<List<InventoryStockDTO>> getAllStock() {
        List<InventoryStockDTO> stocks = inventoryService.getAllStock();
        return ResponseEntity.ok(stocks);
    }

    @GetMapping("/expiring-soon")
    public ResponseEntity<List<Map<String, Object>>> getExpiringSoon(
            @RequestParam(defaultValue = "30") int days) {
        List<Map<String, Object>> expiring = inventoryService.getExpiringSoon(days);
        return ResponseEntity.ok(expiring);
    }

    @GetMapping("/check-stock/{issueReqId}")
    public ResponseEntity<Map<String, Object>> checkStockForRequest(@PathVariable Long issueReqId) {
        Map<String, Object> result = inventoryService.checkStockForRequest(issueReqId);
        return ResponseEntity.ok(result);
    }
}