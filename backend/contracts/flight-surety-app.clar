
;; flight-surety-app

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
(define-constant AIRLINE_NOT_FUNDED (err u3008))
(define-constant FLIGHT_NOT_REGISTERED (err u3008))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant AIRLINE_FUNDING u500000000) 
(define-constant AIRLINE_STATE 
  (list "Init" "Application" "Registered" "Funded")
)

;; data maps and vars
;;
(define-data-var operational bool true)
(define-data-var dataContract principal 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.flight-surety-data)

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
    ;; #[filter(status)]
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

(define-read-only (airlines-count) 
  (contract-call? .flight-surety-data get-airlines-count)
)

(define-private (has-already-voted (caller principal) (airline principal)) 
  (is-none (index-of (default-to (list ) (get voters (get-airline airline))) caller))
)

(define-private (voting-consensus (airline principal)) 
  (let 
    (
      (registeredAirlines (airlines-count))
      (airlineVotes  (+ (len (default-to (list ) (get voters (get-airline airline)))) u1) )
    ) 
    (if (>= airlineVotes (+ (/ registeredAirlines u2) (mod registeredAirlines u2))) u2 u1)  
  )
)

(define-read-only (get-airline (airline principal)) 
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
    (as-contract (contract-call? .flight-surety-data funded-airline-state caller AIRLINE_FUNDING))
  )
)

;; flight functions
;;
(define-read-only (get-flight (airlineId uint) (flightId (string-ascii 7))) 
  (contract-call? .flight-surety-data get-flight airlineId flightId)
)

(define-public (register-flight (flightId (string-ascii 7)) (payouts {status: (list 4 uint),payout: (list 4 uint) }) (maxPayout uint) (activate bool))
  (let 
    (
      (airlineId (unwrap! (get airline-id (get-airline tx-sender)) AIRLINE_NOT_FOUND))
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)
    (asserts! (has-airline-state tx-sender u3) AIRLINE_NOT_FUNDED)
    (as-contract (contract-call? .flight-surety-data register-flight airlineId flightId activate payouts maxPayout))
  )
)

(define-public (update-flight (flightId uint) (departure int) (status uint))
  (let
    (
      (airline (unwrap! (contract-call? .flight-surety-data get-airline-by-flight flightId) AIRLINE_NOT_FOUND))
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)
    (asserts! (is-eq tx-sender airline) ERR_UNAUTHORISED)
    (as-contract (contract-call? .flight-surety-data update-flight-status flightId departure status))
  )
)

;; Surety functions
;;
(define-read-only (get-surety (insuree principal) (flightId uint))
  (contract-call? .flight-surety-data get-surety insuree flightId)
)

(define-public (purchase-surety (flightId uint) (departure int) (amount uint))
  (let 
    (
      (insuree tx-sender)
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED) 
    (try! (stx-transfer? amount tx-sender (var-get dataContract)))
    (as-contract (contract-call? .flight-surety-data purchase-surety insuree flightId departure amount))
  )
)

(define-public (surety-payout (flightId uint))
  (let 
    (
      (insuree tx-sender)
    )
    (asserts! (is-operational) ERR_CONTRACT_PAUSED)
    (as-contract (contract-call? .flight-surety-data redeem-surety insuree flightId))
  )
)