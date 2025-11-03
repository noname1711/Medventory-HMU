package com.backend.service;

import com.backend.dto.SuppForecastDetailDTO;
import com.backend.dto.SuppForecastRequestDTO;
import com.backend.entity.Material;
import com.backend.entity.SuppForecastDetail;
import com.backend.entity.SuppForecastHeader;
import com.backend.entity.User;
import com.backend.repository.MaterialRepository;
import com.backend.repository.SuppForecastHeaderRepository;
import com.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class SuppForecastService {

    @Autowired
    private SuppForecastHeaderRepository headerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MaterialRepository materialRepository;

    @Transactional
    public SuppForecastHeader createForecast(SuppForecastRequestDTO dto) {
        SuppForecastHeader header = new SuppForecastHeader();
        header.setAcademicYear(dto.getAcademicYear());
        header.setDepartmentId(dto.getDepartmentId());
        header.setStatus("pending");

        if (dto.getCreatedByEmail() != null && !dto.getCreatedByEmail().isBlank()) {
            Optional<User> uOpt = userRepository.findByEmail(dto.getCreatedByEmail());
            uOpt.ifPresent(header::setCreatedBy);
        }

        if (dto.getItems() != null) {
            for (SuppForecastDetailDTO itemDto : dto.getItems()) {
                SuppForecastDetail detail = new SuppForecastDetail();
                detail.setHeader(header);

                if (itemDto.getMaterialId() != null) {
                    Optional<Material> mOpt = materialRepository.findById(itemDto.getMaterialId());
                    mOpt.ifPresent(detail::setMaterial);
                }

                if (itemDto.getCurrentStock() != null) detail.setCurrentStock(itemDto.getCurrentStock());
                if (itemDto.getPrevYearQty() != null) detail.setPrevYearQty(itemDto.getPrevYearQty());
                detail.setThisYearQty(itemDto.getThisYearQty());
                detail.setProposedCode(itemDto.getProposedCode());
                detail.setProposedManufacturer(itemDto.getProposedManufacturer());
                detail.setJustification(itemDto.getJustification());

                header.getDetails().add(detail);
            }
        }

        return headerRepository.save(header);
    }
}
