package com.backend.controller;

import com.backend.dto.SuppForecastRequestDTO;
import com.backend.entity.SuppForecastHeader;
import com.backend.service.SuppForecastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/supp-forecasts")
@CrossOrigin(origins = "http://localhost:5173")
public class SuppForecastController {

    @Autowired
    private SuppForecastService forecastService;

    @PostMapping
    public ResponseEntity<?> createForecast(@RequestBody SuppForecastRequestDTO request) {
        try {
            SuppForecastHeader header = forecastService.createForecast(request);
            return ResponseEntity.ok().body(
                    java.util.Map.of("success", true, "message", "Tạo phiếu dự trù thành công", "headerId", header.getId())
            );
        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.badRequest().body(
                    java.util.Map.of("success", false, "message", "Lỗi khi tạo phiếu: " + ex.getMessage())
            );
        }
    }

    @GetMapping("/previous")
    public ResponseEntity<?> loadPrevious(
            @RequestParam(required = false) Integer departmentId
    ) {
        try {
            var data = forecastService.loadPreviousForecast(departmentId);

            return ResponseEntity.ok(data);

        } catch (Exception ex) {
            ex.printStackTrace();
            return ResponseEntity.badRequest().body(
                    java.util.Map.of("error", ex.getMessage())
            );
        }
    }
}
