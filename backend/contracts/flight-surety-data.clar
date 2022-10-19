
;; flight-surety-data
;; <add a description here>


;; error consts   ;;;********* mainly handled by app, keep only data related no logic
;;
(define-constant ERR_UNAUTHORISED (err u2011))
(define-constant NOT_WHITELISTED (err u2012))


(define-constant AIRLINE_NOT_FOUND (err u2100))
(define-constant FLIGHT_NOT_FOUND (err u2101))
(define-constant SURETY_NOT_FOUND (err u2102))
(define-constant INDEX_NOT_FOUND (err u2103))
(define-constant ELEMENT_NOT_FOUND (err u2104))
(define-constant MAX_AIRLINES_EXCEEDED (err u2105))
(define-constant MAX_PAYOUT_EXCEEDED (err u2106))
(define-constant AIRLINE_NOT_FUNDED (err u2107))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))

;; data maps and vars
;;
(define-data-var registeredAirlines uint u0) ;; Airlines registered
(define-data-var idCounter uint u0)  ;; Airlines ID counter
(define-data-var registeredFlights uint u0) ;; Flights registered

(define-map AuthorizedCallers principal bool)
(define-map Airlines 
  principal 
  { 
    airline-id: uint,
    airline-state: uint,
    airline-name: (string-ascii 40),
    voters:  (list 25 principal),
  }
)

(define-map AirlinesFund principal uint)

(define-map Flights 
  { flight-id: (string-ascii 7), airline-id: uint } 
  { 
    active: bool,
    status-code: (list 4 uint),
    payout: (list 4 uint),
    max-payout: uint,
  }
)

(define-map Sureties 
  {
    insuree: principal,
    flight-id: (string-ascii 7), 
    airline-id: uint,
  } 
  { 
    departure: int,
    payouts: {
      code: (list 4 uint),
      amount: (list 4 uint)
    },
  }
)

;; verify if funded state or something els should be added ----> has to be checked in tests, not done yet
(define-map RegisteredAirlines uint principal)   ;; < implement , could be useful .... done for airline deployment, contract logic tbd
(define-map RegisteredFlights uint {flight-name: (string-ascii 7), airline-id: uint }) 

;; init first airline on deployment
(map-set Airlines 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  { 
    airline-id: u1,
    airline-state: u2,
    airline-name: "First Airline",
    voters:  (list ),
  }
)
(map-set RegisteredAirlines u1 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(var-set registeredAirlines u1)
(var-set idCounter u1)

;; private functions
;;

(define-private (register (airline principal) (id uint))
  (begin 
    (map-set RegisteredAirlines id airline)
    (var-set registeredAirlines (+ (var-get registeredAirlines) u1))
  )
)

(define-private (set-airline-state (airline principal) (state uint))
  (map-set Airlines airline (merge (unwrap-panic (get-airline airline)) {airline-state: state}))
)

;; public functions
;;

;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? AuthorizedCallers app-contract))
)
;; (contract-call? .flight-surety-data is-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

(define-public (set-whitelisted (appContract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(appContract, whitelisted)]
		(ok (map-set AuthorizedCallers appContract whitelisted))
	)
)
;; (contract-call? .flight-surety-data set-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM true)

;; airlines
(define-read-only (get-airlines-count) 
  (var-get registeredAirlines)
)
;; (contract-call? .flight-surety-data get-airlines-count)

(define-read-only (get-airline (airline principal)) 
  (map-get? Airlines airline)
)

(define-public (add-airline-data (airline principal) (airlineName (string-ascii 30)) (caller principal) (status uint)) 
  (let 
    (
      (airlineData (get-airline airline))
      (id (if (is-none airlineData) 
          (+ (var-get idCounter) u1) 
          (unwrap-panic (get airline-id airlineData))
      ))
      (voteList (if (is-none airlineData) 
          (list caller) 
          (append (unwrap-panic (get voters airlineData)) caller)
      ))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(airline, airlineName, caller, status)]
    (map-set Airlines airline {
      airline-id: id,
      airline-state: status,
      airline-name: airlineName,
      voters:  (unwrap! (as-max-len? voteList u25) MAX_AIRLINES_EXCEEDED),
    })

    (if (is-none airlineData) (var-set idCounter id) false)
    (if (is-eq status u2) (register airline id) false) 
    
    (ok {airline-id: id, airline-state: status, votes: (len voteList), reg-airlines: (var-get registeredAirlines) })
  )
)

(define-public (funded-airline-state (airline principal) (funding uint))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    (asserts! (is-some (get-airline airline) ) AIRLINE_NOT_FOUND)
    ;; #[filter(airline, funding)]
    (map-set AirlinesFund airline funding)
    (ok (set-airline-state airline u3))
  )
)

;;  flights
(define-read-only (get-flight (airlineId uint) (flightId (string-ascii 7)))
  (map-get? Flights { flight-id: flightId, airline-id: airlineId })
)

(define-public (register-flight (airlineId uint) (flightId (string-ascii 7)) (activate bool) (payouts {status: (list 4 uint),payout: (list 4 uint) }) (maxPayout uint))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(flightId, airlineId, activate, payouts, maxPayout)]
    (map-set Flights { flight-id: flightId, airline-id: airlineId } {
       active: activate,
       status-code: (get status payouts),
       payout: (get payout payouts),
       max-payout: maxPayout,
    })
    (ok true)
  )
)

;; purchase sureties
(define-private (calculate-amounts (multiplier (list 4 uint)) (amount uint) ) 
  (map / (map * (list amount amount amount amount) multiplier) (list u100 u100 u100 u100)) 
)

(define-private (check-max-amount (max uint) (amounts (list 4 uint))) 
  (match (index-of (map >= (list max max max max) amounts) false) value false true)
)

(define-read-only (get-surety (insuree principal) (airlineId uint) (flightId (string-ascii 7)))
  (map-get? Sureties {insuree: insuree, flight-id: flightId, airline-id: airlineId})
)

(define-public (purchase-surety (insuree principal) (airlineId uint) (flightId (string-ascii 7)) (departure int) (amount uint))
  (let
    (
      (flight (unwrap! (map-get? Flights { flight-id: flightId, airline-id: airlineId }) FLIGHT_NOT_FOUND))
      (amounts (calculate-amounts (get payout flight) amount))
      (airline (unwrap! (map-get? RegisteredAirlines airlineId) AIRLINE_NOT_FOUND))
      (airlineFund (unwrap! (map-get? AirlinesFund airline) AIRLINE_NOT_FUNDED))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    (asserts! (check-max-amount (get max-payout flight) amounts) MAX_PAYOUT_EXCEEDED)
    ;;; check timestamp is min 1 day in future
    ;; #[filter(flightId, airlineId, insuree, departure)]
    (map-set Sureties {insuree: insuree, flight-id: flightId, airline-id: airlineId} {
      departure: 	departure,
      payouts: { code: (get status-code flight), amount: amounts },
    })
    (map-set AirlinesFund airline (+ amount airlineFund))
    (ok true)
  )
)

(define-public (surety-payout (insuree principal) (airlineId uint) (flightId (string-ascii 7)) (statusCode uint)) 
  (let
    (
      (payout (unwrap! (get payouts (map-get? Sureties {insuree: insuree, flight-id: flightId, airline-id: airlineId})) SURETY_NOT_FOUND))
      (index (unwrap! (index-of (get code payout) statusCode) INDEX_NOT_FOUND))
      (amount (unwrap! (element-at (get amount payout) index) ELEMENT_NOT_FOUND))
      (airline (unwrap! (map-get? RegisteredAirlines airlineId) AIRLINE_NOT_FOUND))
      (airlineFund (unwrap! (map-get? AirlinesFund airline) AIRLINE_NOT_FUNDED))
    ) 
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(flightId, airlineId, amount, airline, airlineFund, insuree)]
    (map-set AirlinesFund airline (- airlineFund amount))
    (map-delete Sureties {insuree: insuree, flight-id: flightId, airline-id: airlineId})
    (as-contract (stx-transfer? amount CONTRACT_ADDRESS insuree))
    
  )
)