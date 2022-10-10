
;; flight-surety-app
;; <add a description here>

;; (use-trait trait-alias .data-trait.data-storage-trait)

;; constants
;;
(define-constant contract-owner tx-sender)

(define-constant test-data ".flight-surety-data")
(define-data-var data-contract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
(define-constant contract-data 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)

;; data maps and vars
;;

;; private functions
;;

;; public functions
;;

(define-read-only (registered-airline-count) 
  (contract-call? .flight-surety-data get-airlines-count)
)

(define-read-only (has-data-access) 
  (contract-call? .flight-surety-data is-whitelisted (as-contract tx-sender))
)

(define-public (whitelist-app-contract) 
  (contract-call? .flight-surety-data set-whitelisted (as-contract tx-sender) true)
)
;; (contract-call? .flight-surety-app registered-airline-count )

;;(define-public (call-data-contract (data-storage-ref <trait-alias>))
;;  (as-contract (contract-call? data-storage-ref check-connection tx-sender))
;;  
;;)


;;(define-public (call-data-contract)
;;  (contract-call? .flight-surety-data check-connection tx-sender)
;;  
;;)

;;(define-public (count-up (data-storage-ref <trait-alias>))
;;  (contract-call? data-storage-ref count)
;;)

;;(define-public (count-up)
;;  (contract-call? .flight-surety-data count)
;;)

;;(define-read-only (get-data-contract) 
;;  (var-get data-contract)
;;)