package com.backend.repository;

import com.backend.entity.InventoryCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryCardRepository extends JpaRepository<InventoryCard, Long> {

    // existing
    Optional<InventoryCard> findTopByMaterialIdAndLotNumberOrderByRecordDateDescIdDesc(Long materialId, String lotNumber);

    // Lấy "bản ghi mới nhất" cho mỗi lot của 1 material, chỉ lấy lot còn tồn > 0,
    // đồng thời order FEFO (exp_date gần nhất trước), fallback theo mfg_date/lot.
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (ic.lot_number) ic.*
                FROM inventory_card ic
                WHERE ic.material_id = :materialId
                ORDER BY ic.lot_number, ic.record_date DESC, ic.id DESC
            ) t
            WHERE t.closing_stock > 0
            ORDER BY t.exp_date NULLS LAST, t.mfg_date NULLS LAST, t.lot_number
            """, nativeQuery = true)
    List<InventoryCard> findAvailableLotsLatestByMaterial(@Param("materialId") Long materialId);

    // Lock bản ghi mới nhất của (material, lot) để tránh xuất trùng trong concurrency
    @Query(value = """
            SELECT * FROM inventory_card
            WHERE material_id = :materialId AND lot_number = :lotNumber
            ORDER BY record_date DESC, id DESC
            LIMIT 1
            FOR UPDATE
            """, nativeQuery = true)
    Optional<InventoryCard> lockLatestByMaterialAndLot(@Param("materialId") Long materialId,
                                                       @Param("lotNumber") String lotNumber);
}
