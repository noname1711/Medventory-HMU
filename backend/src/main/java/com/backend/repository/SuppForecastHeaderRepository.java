package com.backend.repository;

import com.backend.entity.SuppForecastHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
@Repository
public interface SuppForecastHeaderRepository extends JpaRepository<SuppForecastHeader, Long> {

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year")
    List<SuppForecastHeader> findByAcademicYear(@Param("year") String year);

    @Query("SELECT h FROM SuppForecastHeader h WHERE h.academicYear = :year AND h.departmentId = :deptId")
    List<SuppForecastHeader> findByAcademicYearAndDepartmentId(
            @Param("year") String year,
            @Param("deptId") Integer deptId
    );
}
