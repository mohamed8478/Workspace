package com.cmpe.workspace.enums;

public enum Department {
    Achat,
    HR,
    Maintenance,
    Production,
    ControleDeGestion,
    ServiceInformatique,

    // Legacy values kept so existing task rows created before the department update still load.
    ENGINEERING,
    PRODUCT_DESIGN,
    MARKETING,
    SALES,
    CUSTOMER_SUCCESS,
    FINANCE,
    OPERATIONS,
    DEVOPS,
    SUPPORT,
}
