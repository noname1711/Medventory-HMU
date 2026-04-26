package com.backend.controller;

import com.backend.dto.SuppForecastApprovalDTO;
import com.backend.dto.SuppForecastRequestDTO;
import com.backend.entity.SuppForecastHeader;
import com.backend.service.SuppForecastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/supp-forecast")
@CrossOrigin(origins = "http://localhost:5173")
public class SuppForecastController {

    @Autowired
    private SuppForecastService forecastService;

    @GetMapping("/bgh/pending")
    public ResponseEntity<?> getPendingForecasts(@RequestParam Long bghId) {
        return forecastService.getPendingForecasts(bghId);
    }

    @GetMapping("/bgh/processed")
    public ResponseEntity<?> getProcessedForecasts(@RequestParam Long bghId) {
        return forecastService.getProcessedForecasts(bghId);
    }

    @PostMapping("/approve")
    public ResponseEntity<?> approveForecast(@RequestBody SuppForecastApprovalDTO request) {
        return forecastService.approveForecast(request);
    }

    @GetMapping("/bgh/stats")
    public ResponseEntity<?> getStats(@RequestParam Long bghId) {
        return forecastService.getStats(bghId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getForecastDetail(@PathVariable Long id, @RequestParam Long userId) {
        try {
            return ResponseEntity.ok(forecastService.getForecastDetail(id, userId));
        } catch (SecurityException ex) {
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createForecast(@RequestBody SuppForecastRequestDTO request) {
        try {
            SuppForecastHeader header = forecastService.createForecast(request);
            return ResponseEntity.ok().body(Map.of(
                    "success", true,
                    "message", "Tao phieu du tru thanh cong",
                    "headerId", header.getId()
            ));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Loi khi tao phieu: " + ex.getMessage()
            ));
        }
    }

    @GetMapping("/previous")
    public ResponseEntity<?> loadPrevious(@RequestParam(required = false) Long departmentId) {
        try {
            return ResponseEntity.ok(forecastService.loadPreviousForecast(departmentId));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
