package com.backend.repository;

import com.backend.entity.SuppForecastDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SuppForecastDetailRepository extends JpaRepository<SuppForecastDetail, Long> {
}