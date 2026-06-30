package com.backend.controller;

import com.backend.dto.MaterialStockPageDTO;
import com.backend.service.InventorySummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/inventory")
public class InventorySummaryController {

    private final InventorySummaryService inventorySummaryService;

    @GetMapping("/materials")
    public ResponseEntity<MaterialStockPageDTO> getMaterialStock(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, defaultValue = "all") String status,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(
                inventorySummaryService.getMaterialStockSummary(keyword, status, page, size)
        );
    }
}
