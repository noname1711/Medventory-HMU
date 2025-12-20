package com.backend.repository;

import com.backend.entity.IssueReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface IssueReservationRepository extends JpaRepository<IssueReservation, Long> {

    List<IssueReservation> findByIssueReqHeader_Id(Long issueReqHeaderId);

    List<IssueReservation> findByIssueReqHeader_IdAndStatus_Code(Long issueReqHeaderId, String statusCode);

    @Query("""
        SELECT COALESCE(SUM(r.qtyReserved), 0)
        FROM IssueReservation r
        WHERE r.material.id = :materialId
          AND r.lotNumber = :lotNumber
          AND r.status.code = 'ACTIVE'
    """)
    BigDecimal sumActiveReservedByMaterialAndLot(@Param("materialId") Long materialId,
                                                 @Param("lotNumber") String lotNumber);

    @Query("""
        SELECT r
        FROM IssueReservation r
        WHERE r.material.id = :materialId
          AND r.lotNumber = :lotNumber
          AND r.status.code = 'ACTIVE'
        ORDER BY r.createdAt ASC
    """)
    List<IssueReservation> findActiveByMaterialAndLotOrderByCreatedAtAsc(@Param("materialId") Long materialId,
                                                                         @Param("lotNumber") String lotNumber);
}
