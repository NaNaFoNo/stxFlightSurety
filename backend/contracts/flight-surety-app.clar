
;; flight-surety-app
;; <add a description here>

;; error consts
;;
(define-constant ERR_CONTRACT_PAUSED (err u3010))
(define-constant ERR_UNAUTHORISED (err u3011))

(define-constant AIRLINE_NOT_FOUND (err u3001))
(define-constant BAD_AIRLINE_STATUS (err u3002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u3003))
(define-constant ONLY_BY_REGISTERED_AIRLINE (err u3004))
(define-constant AIRLINE_ALREADY_FUNDED (err u3005))
(define-constant ALREADY_VOTED (err u3007))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant AIRLINE_FUNDING u1000000)  ;; move to app --> logic
(define-constant AIRLINE_STATE ;; move to app --> logic
  (list "Init" "Application" "Registered" "Funded")
)
;;(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
;;(define-constant contract-data 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
;;(define-constant test-data ".flight-surety-data")
(define-data-var operational bool true)
(define-data-var dataContract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)
(define-data-var appContract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-app)

;; contract authorizations
;;
(define-read-only (is-operational) 
  (var-get operational)
)

(define-read-only (has-data-access) 
  (contract-call? .flight-surety-data is-whitelisted (as-contract tx-sender))
)

(define-public (set-operating-status (status bool))
  (begin
    (asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    (ok (var-set operational status))
  )
)

(define-public (whitelist-app-contract)
  (begin
    (asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED) 
    (contract-call? .flight-surety-data set-whitelisted (as-contract tx-sender) true)
  )
)

;; airline functions
;;
(define-private (has-airline-state (airline principal) (state uint)) 
  (is-eq (default-to u0 (get airline-state (get-airline airline))) state)
)

(define-private (is-registered (airline principal)) 
  (>= (default-to u0 (get airline-state (get-airline airline))) u2)
)

(define-read-only (registered-airline-count)  ;; to airline count
  (contract-call? .flight-surety-data get-airlines-count)
)

(define-private (has-already-voted (caller principal) (airline principal)) 
  (is-none (index-of (default-to (list ) (get voters (get-airline airline))) caller))
)

(define-private (voting-consensus (airline principal)) 
  (let 
    (
      (registeredAirlines (registered-airline-count))
      (airlineVotes  (+ (len (default-to (list ) (get voters (get-airline airline)))) u1) )
    ) 
    (if (>= airlineVotes (+ (/ registeredAirlines u2) (mod registeredAirlines u2))) u2 u1)  
  )
)


(define-read-only (get-airline (airline principal)) ;; main get fct , following extract throuh private
  (contract-call? .flight-surety-data get-airline airline)
)


(define-public (add-airline (airline principal) (airlineName (string-ascii 30)) (caller principal)) 
  (begin
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)
    (asserts! (is-registered caller) ONLY_BY_REGISTERED_AIRLINE)
    (asserts! (not (is-registered airline)) AIRLINE_ALREADY_REGISTERED) 
    (asserts! (has-already-voted caller airline) ALREADY_VOTED)

    (as-contract (contract-call? .flight-surety-data add-airline-data airline airlineName caller (voting-consensus airline)))
  )
)

(define-public (fund-airline) 
  (let
    (
      (caller tx-sender)
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)
    (asserts! (is-registered caller) ONLY_BY_REGISTERED_AIRLINE)
    (asserts! (not (has-airline-state caller u3)) AIRLINE_ALREADY_FUNDED) 
    
    (try! (stx-transfer? AIRLINE_FUNDING caller (var-get dataContract)))
    (as-contract (contract-call? .flight-surety-data funded-airline-state caller))
  )
)
;; (contract-call? .flight-surety-app fund-airline)