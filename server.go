package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	port := "8080"
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	fmt.Printf("Server running at http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
